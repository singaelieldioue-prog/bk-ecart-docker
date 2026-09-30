import React, { useState } from "react";
import { WORKFLOW } from "../constants.js";

export const TH = { padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#555", borderBottom: "2px solid #E5E7EB", fontSize: 11 };
export const TD = { padding: "6px 10px", color: "#374151", borderBottom: "1px solid #F3F4F6", fontSize: 12 };


export function Bdg({ s, children, sm }) {
  const C = {
    excellent: { bg: "#ECFDF5", color: "#059669" },
    warning: { bg: "#FFFBEB", color: "#D97706" },
    danger: { bg: "#FEF2F2", color: "#DC2626" },
  };
  const st = C[s] || { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span
      style={{
        background: st.bg,
        color: st.color,
        borderRadius: 6,
        padding: sm ? "1px 6px" : "3px 8px",
        fontSize: sm ? 10 : 11,
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

export function WBdg({ status }) {
  const w = WORKFLOW[status] || WORKFLOW.draft;
  return (
    <span
      style={{
        background: w.bg,
        color: w.color,
        borderRadius: 6,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {w.label}
    </span>
  );
}

export function KCard({ label, value, sub, s }) {
  const C = {
    excellent: "#059669",
    warning: "#D97706",
    danger: "#DC2626",
  };
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 9,
        padding: "10px 14px",
        flex: "1 1 140px",
        minWidth: 130,
      }}
    >
      <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C[s] || "#111", marginTop: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function DropZone({ label, icon, onFile, fileName, required, multiple }) {
  return (
    <label
      style={{
        display: "block",
        border: `2px dashed ${fileName ? "#059669" : "#D1D5DB"}`,
        borderRadius: 9,
        padding: "10px 14px",
        textAlign: "center",
        cursor: "pointer",
        background: fileName ? "#ECFDF5" : "#FAFAFA",
        transition: "all .15s",
      }}
    >
      <input
        type="file"
        accept=".xlsx,.csv"
        multiple={multiple}
        style={{ display: "none" }}
        onChange={(e) => {
          if (multiple) onFile(Array.from(e.target.files));
          else onFile(e.target.files[0]);
        }}
      />
      <span style={{ fontSize: 16, marginRight: 6 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: fileName ? "#059669" : "#374151" }}>
        {fileName || label}
      </span>
      {required && !fileName && <span style={{ color: "#DC2626", marginLeft: 4 }}>*</span>}
    </label>
  );
}

export function CModal({ title, placeholder, actionLabel, color, onConfirm, onCancel }) {
  const [val, setVal] = useState("");
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          width: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,.15)",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{title}</div>
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{
            width: "100%",
            padding: 9,
            borderRadius: 7,
            border: "1px solid #D1D5DB",
            fontSize: 12,
            marginBottom: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "7px 14px",
              border: "1px solid #D1D5DB",
              borderRadius: 7,
              background: "#fff",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(val)}
            style={{
              padding: "7px 14px",
              border: "none",
              borderRadius: 7,
              background: color || "#D4531D",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
