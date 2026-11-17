-- ==============================================================================
-- Migration: 20261118000001_scan_rpc.sql
-- Description: Transactional scan_student function with row locking & state machine
-- System: Hostel Library Pass & Student Movement System
-- ==============================================================================

-- Structure for scan result
create type scan_result_type as (
  success boolean,
  event_type movement_event_type,
  reason_code text,
  message text,
  student_id uuid,
  roll_number text,
  full_name text,
  category student_category,
  in_library smallint,
  session_id uuid,
  timestamp timestamptz
);

-- Transactional scan function
create or replace function scan_student(
  p_student_id uuid,
  p_checkpoint_id uuid,
  p_scanner_id uuid,
  p_idempotency_key text,
  p_device_id text default null,
  p_scan_mode text default 'AUTO' -- 'AUTO', 'ENTRY_ONLY', 'EXIT_ONLY'
)
returns jsonb as $$
declare
  v_student record;
  v_checkpoint record;
  v_last_event record;
  v_session record;
  v_new_session_id uuid;
  v_event_type movement_event_type;
  v_reason text := null;
  v_dup_window int := 10; -- seconds
  v_max_stay_mins int := 360; -- default 6 hours
  v_expected_exit timestamptz;
  v_existing_event record;
  v_result jsonb;
begin
  -- 1. Idempotency Check
  if p_idempotency_key is not null then
    select * into v_existing_event from movement_events where idempotency_key = p_idempotency_key limit 1;
    if found then
      select * into v_student from students where id = v_existing_event.student_id;
      return jsonb_build_object(
        'success', (v_existing_event.event_type in ('LIBRARY_ENTRY', 'LIBRARY_EXIT')),
        'event_type', v_existing_event.event_type,
        'reason_code', coalesce(v_existing_event.reason_code, 'IDEMPOTENT_REPLAY'),
        'message', 'Replayed identical scan request',
        'student_id', v_student.id,
        'roll_number', v_student.roll_number,
        'full_name', v_student.full_name,
        'category', v_student.category,
        'in_library', v_student.in_library,
        'session_id', v_existing_event.library_session_id,
        'timestamp', v_existing_event.recorded_at
      );
    end if;
  end if;

  -- 2. Lock and retrieve Student Row (FOR UPDATE prevents concurrency race conditions)
  select * into v_student from students where id = p_student_id for update;
  if not found then
    -- Record rejected scan with null student
    insert into movement_events (
      student_id, checkpoint_id, event_type, recorded_by, device_id,
      verification_status, reason_code, idempotency_key, notes
    ) values (
      null, p_checkpoint_id, 'REJECTED_SCAN', p_scanner_id, p_device_id,
      'REJECTED', 'STUDENT_NOT_FOUND', p_idempotency_key, 'Student record not found in database'
    );

    return jsonb_build_object(
      'success', false,
      'event_type', 'REJECTED_SCAN',
      'reason_code', 'STUDENT_NOT_FOUND',
      'message', 'Student does not exist or has invalid ID tag',
      'student_id', null,
      'timestamp', now()
    );
  end if;

  -- 3. Check Student Active Status
  if not v_student.is_active then
    insert into movement_events (
      student_id, checkpoint_id, event_type, recorded_by, device_id,
      verification_status, reason_code, idempotency_key, notes
    ) values (
      v_student.id, p_checkpoint_id, 'REJECTED_SCAN', p_scanner_id, p_device_id,
      'REJECTED', 'STUDENT_INACTIVE', p_idempotency_key, 'Student account is suspended or inactive'
    );

    return jsonb_build_object(
      'success', false,
      'event_type', 'REJECTED_SCAN',
      'reason_code', 'STUDENT_INACTIVE',
      'message', 'Student account is inactive/disabled. Contact administration.',
      'student_id', v_student.id,
      'roll_number', v_student.roll_number,
      'full_name', v_student.full_name,
      'category', v_student.category,
      'in_library', v_student.in_library,
      'timestamp', now()
    );
  end if;

  -- 4. Check Checkpoint
  select * into v_checkpoint from checkpoints where id = p_checkpoint_id;
  if not found or not v_checkpoint.is_active then
    insert into movement_events (
      student_id, checkpoint_id, event_type, recorded_by, device_id,
      verification_status, reason_code, idempotency_key, notes
    ) values (
      v_student.id, p_checkpoint_id, 'REJECTED_SCAN', p_scanner_id, p_device_id,
      'REJECTED', 'CHECKPOINT_INACTIVE', p_idempotency_key, 'Checkpoint not found or inactive'
    );

    return jsonb_build_object(
      'success', false,
      'event_type', 'REJECTED_SCAN',
      'reason_code', 'CHECKPOINT_INACTIVE',
      'message', 'Scanning checkpoint is currently inactive',
      'student_id', v_student.id,
      'timestamp', now()
    );
  end if;

  -- 5. Duplicate Scan Guard (Within 10 seconds at same checkpoint)
  select * into v_last_event from movement_events
    where student_id = v_student.id
      and checkpoint_id = p_checkpoint_id
      and recorded_at > (now() - (v_dup_window || ' seconds')::interval)
    order by recorded_at desc limit 1;

  if found then
    insert into movement_events (
      student_id, checkpoint_id, event_type, recorded_by, device_id,
      verification_status, reason_code, idempotency_key, notes
    ) values (
      v_student.id, p_checkpoint_id, 'REJECTED_SCAN', p_scanner_id, p_device_id,
      'REJECTED', 'DUPLICATE_SCAN', p_idempotency_key, 'Card was scanned again within debounce window'
    );

    return jsonb_build_object(
      'success', false,
      'event_type', 'REJECTED_SCAN',
      'reason_code', 'DUPLICATE_SCAN',
      'message', 'Card scanned multiple times within 10 seconds. Please wait.',
      'student_id', v_student.id,
      'roll_number', v_student.roll_number,
      'full_name', v_student.full_name,
      'category', v_student.category,
      'in_library', v_student.in_library,
      'timestamp', now()
    );
  end if;

  -- 6. State Machine Determination
  if v_student.in_library = 0 then
    -- Attempting ENTRY
    if p_scan_mode = 'EXIT_ONLY' or v_checkpoint.type = 'LIBRARY_EXIT' then
      v_reason := 'WRONG_CHECKPOINT_DIRECTION';
      insert into movement_events (
        student_id, checkpoint_id, event_type, recorded_by, device_id,
        verification_status, reason_code, idempotency_key, notes
      ) values (
        v_student.id, p_checkpoint_id, 'REJECTED_SCAN', p_scanner_id, p_device_id,
        'REJECTED', v_reason, p_idempotency_key, 'Cannot exit: Student is currently marked outside'
      );

      return jsonb_build_object(
        'success', false,
        'event_type', 'REJECTED_SCAN',
        'reason_code', v_reason,
        'message', 'Student is already outside the library (cannot exit)',
        'student_id', v_student.id,
        'roll_number', v_student.roll_number,
        'full_name', v_student.full_name,
        'category', v_student.category,
        'in_library', v_student.in_library,
        'timestamp', now()
      );
    end if;

    -- Valid ENTRY
    v_expected_exit := now() + (v_max_stay_mins || ' minutes')::interval;

    insert into library_sessions (
      student_id, entered_at, entry_checkpoint_id, entered_by, status, expected_exit_by
    ) values (
      v_student.id, now(), p_checkpoint_id, p_scanner_id, 'OPEN', v_expected_exit
    ) returning id into v_new_session_id;

    update students set
      in_library = 1,
      last_scan_at = now()
    where id = v_student.id;

    insert into movement_events (
      student_id, library_session_id, checkpoint_id, event_type, recorded_by,
      recorded_at, device_id, verification_status, idempotency_key, notes
    ) values (
      v_student.id, v_new_session_id, p_checkpoint_id, 'LIBRARY_ENTRY', p_scanner_id,
      now(), p_device_id, 'VERIFIED', p_idempotency_key, 'Student entered central library'
    );

    return jsonb_build_object(
      'success', true,
      'event_type', 'LIBRARY_ENTRY',
      'reason_code', 'ENTRY_SUCCESS',
      'message', 'Access granted: Student checked into library',
      'student_id', v_student.id,
      'roll_number', v_student.roll_number,
      'full_name', v_student.full_name,
      'category', v_student.category,
      'in_library', 1,
      'session_id', v_new_session_id,
      'timestamp', now()
    );

  else
    -- Currently in_library = 1, Attempting EXIT
    if p_scan_mode = 'ENTRY_ONLY' or v_checkpoint.type = 'LIBRARY_ENTRY' then
      v_reason := 'WRONG_CHECKPOINT_DIRECTION';
      insert into movement_events (
        student_id, checkpoint_id, event_type, recorded_by, device_id,
        verification_status, reason_code, idempotency_key, notes
      ) values (
        v_student.id, p_checkpoint_id, 'REJECTED_SCAN', p_scanner_id, p_device_id,
        'REJECTED', v_reason, p_idempotency_key, 'Cannot enter: Student is currently marked inside library'
      );

      return jsonb_build_object(
        'success', false,
        'event_type', 'REJECTED_SCAN',
        'reason_code', v_reason,
        'message', 'Student is already inside the library (cannot re-enter without exiting)',
        'student_id', v_student.id,
        'roll_number', v_student.roll_number,
        'full_name', v_student.full_name,
        'category', v_student.category,
        'in_library', v_student.in_library,
        'timestamp', now()
      );
    end if;

    -- Valid EXIT: Close open session
    select * into v_session from library_sessions
      where student_id = v_student.id and status = 'OPEN'
      order by entered_at desc limit 1;

    if found then
      update library_sessions set
        exited_at = now(),
        exit_checkpoint_id = p_checkpoint_id,
        exited_by = p_scanner_id,
        status = 'CLOSED'
      where id = v_session.id;
      v_new_session_id := v_session.id;
    else
      v_new_session_id := null;
    end if;

    update students set
      in_library = 0,
      last_scan_at = now()
    where id = v_student.id;

    insert into movement_events (
      student_id, library_session_id, checkpoint_id, event_type, recorded_by,
      recorded_at, device_id, verification_status, idempotency_key, notes
    ) values (
      v_student.id, v_new_session_id, p_checkpoint_id, 'LIBRARY_EXIT', p_scanner_id,
      now(), p_device_id, 'VERIFIED', p_idempotency_key, 'Student exited central library'
    );

    return jsonb_build_object(
      'success', true,
      'event_type', 'LIBRARY_EXIT',
      'reason_code', 'EXIT_SUCCESS',
      'message', 'Checkout complete: Student exited library',
      'student_id', v_student.id,
      'roll_number', v_student.roll_number,
      'full_name', v_student.full_name,
      'category', v_student.category,
      'in_library', 0,
      'session_id', v_new_session_id,
      'timestamp', now()
    );
  end if;

end;
$$ language plpgsql;
