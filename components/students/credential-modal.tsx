"use client";

import React, { useState } from "react";
import { Copy, Check, Download, Printer, X, ShieldAlert, KeyRound } from "lucide-react";

interface CredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  rollNumber: string;
  credentials: {
    username: string;
    hashCode: string;
  } | null;
}

export function CredentialModal({
  isOpen,
  onClose,
  studentName,
  rollNumber,
  credentials,
}: CredentialModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !credentials) return null;

  const handleCopy = () => {
    const text = `Central Library - Digital Pass Credentials\nStudent: ${studentName}\nRoll No: ${rollNumber}\nUsername: ${credentials.username}\nInitial Password: ${credentials.hashCode}\n\nNote: Change your password on first login.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = `==========================================================\nCENTRAL LIBRARY & HOSTEL DIGITAL PASS SYSTEM\nCREDENTIAL SLIP (CONFIDENTIAL)\n==========================================================\nStudent Name:      ${studentName}\nRoll Number:       ${rollNumber}\nUsername:          ${credentials.username}\nInitial Password:  ${credentials.hashCode}\nIssued At:         ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\n==========================================================\nIMPORTANT:\n1. Keep this password safe. It is NOT stored anywhere in plaintext.\n2. Log in at the portal and update your password.\n3. Your digital QR pass is available in your student portal.\n==========================================================`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `credentials-${credentials.username}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print credential slip.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Credential Slip - ${credentials.username}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #111; }
            .card { border: 2px dashed #444; border-radius: 8px; padding: 24px; max-width: 480px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
            .subtitle { font-size: 12px; color: #555; margin-top: 4px; }
            .field { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
            .label { color: #555; }
            .value { font-weight: 600; }
            .highlight-box { background: #f4f4f4; border: 1px solid #ddd; padding: 12px; border-radius: 6px; text-align: center; margin: 16px 0; }
            .code { font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #c45500; }
            .notice { font-size: 11px; color: #666; line-height: 1.4; border-top: 1px solid #eee; padding-top: 12px; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="title">Hostel & Library Movement System</div>
              <div class="subtitle">Confidential Student Credential Slip</div>
            </div>
            <div class="field">
              <span class="label">Student Name:</span>
              <span class="value">${studentName}</span>
            </div>
            <div class="field">
              <span class="label">Roll Number:</span>
              <span class="value">${rollNumber}</span>
            </div>
            <div class="field">
              <span class="label">Username:</span>
              <span class="value" style="font-family: monospace;">${credentials.username}</span>
            </div>
            <div class="highlight-box">
              <div style="font-size: 11px; text-transform: uppercase; color: #777; margin-bottom: 4px;">Initial One-Time Password</div>
              <div class="code">${credentials.hashCode}</div>
            </div>
            <div class="notice">
              <strong>Instructions:</strong> Sign in at the Student Pass portal using your username and initial password. This code is shown once upon issue and cannot be recovered if lost.
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ash hover:text-whitesmoke p-1.5 rounded-lg hover:bg-surface-raised transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-whitesmoke">
              Student Credentials Generated
            </h3>
            <p className="text-xs text-ash mt-0.5">
              Issued for <span className="text-whitesmoke font-medium">{studentName}</span> ({rollNumber})
            </p>
          </div>
        </div>

        {/* Security Warning Box */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex gap-3 text-xs text-amber-200/90 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Single-Display Security Code:</strong> This password is shown exactly once. It is salted, hashed, and never stored in plaintext. Copy or print it before closing.
          </span>
        </div>

        {/* Credentials Display */}
        <div className="space-y-3 bg-bg/80 border border-border p-4 rounded-lg">
          <div>
            <label className="text-xs text-ash uppercase tracking-wider block font-medium">
              Generated Username
            </label>
            <div className="mt-1 font-mono text-sm text-whitesmoke font-semibold bg-surface px-3 py-2 rounded border border-border">
              {credentials.username}
            </div>
          </div>

          <div>
            <label className="text-xs text-ash uppercase tracking-wider block font-medium">
              Initial Password (12-char Hash Code)
            </label>
            <div className="mt-1 flex items-center justify-between font-mono text-lg text-accent font-bold tracking-widest bg-surface px-3 py-2.5 rounded border border-accent/40">
              <span>{credentials.hashCode}</span>
              <button
                onClick={handleCopy}
                className="text-ash hover:text-accent p-1 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-surface-raised border border-border text-xs font-medium text-whitesmoke hover:bg-border transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-surface-raised border border-border text-xs font-medium text-whitesmoke hover:bg-border transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .txt</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent text-bg font-semibold text-xs hover:bg-accent-hover transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Slip</span>
          </button>
        </div>

        <div className="pt-2 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-surface-raised hover:bg-border text-sm text-whitesmoke font-medium transition-colors"
          >
            Done & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
