import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onKeepAlive: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({
  isOpen,
  secondsRemaining,
  onKeepAlive,
  onLogout
}: SessionTimeoutModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Session Timeout Warning</h2>
        </div>

        <p className="text-gray-600 mb-4">
          Your session is about to expire due to inactivity. You will be automatically logged out in:
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
          <div className="text-4xl font-bold text-gray-900">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className="text-sm text-gray-500 mt-1">minutes remaining</div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onKeepAlive}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Keep Me Logged In
          </button>
          <button
            onClick={onLogout}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}
