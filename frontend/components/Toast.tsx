'use client';

import React from "react";

interface ToastProps {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
  onClick?: () => void;
}

export default function Toast({
  visible,
  title,
  body,
  onClose,
  onClick,
}: ToastProps) {
  return (
    <div
      className={`fixed top-20 right-6 z-[60] transform transition-all duration-300 font-mono ${
        visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
      }`}
      id="toast"
    >
      <div
        onClick={onClick}
        className="bg-error text-on-error p-4 flex items-center gap-4 border-l-4 border-white shadow-2xl cursor-pointer hover:brightness-95 transition-all"
      >
        <span className="material-symbols-outlined text-2xl font-bold">
          warning
        </span>
        <div>
          <div className="font-bold text-xs tracking-wider uppercase">
            {title}
          </div>
          <div className="text-[10px] opacity-90 uppercase mt-0.5">
            {body}
          </div>
        </div>
        <button
          className="ml-4 hover:opacity-50 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  );
}
