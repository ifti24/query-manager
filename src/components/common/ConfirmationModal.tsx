import React from 'react';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (confirmVariant) {
      case 'danger':
        return <Trash2 className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getIconBgColor = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-red-100';
      case 'warning':
        return 'bg-amber-100';
      case 'info':
        return 'bg-blue-100';
    }
  };

  const getConfirmButtonColor = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700';
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 ${getIconBgColor()} rounded-full`}>
            {getIcon()}
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        </div>

        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-white rounded-lg transition-colors font-medium disabled:opacity-50 ${getConfirmButtonColor()}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  userName: string;
  onSoftDelete: () => void;
  onHardDelete: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirmationModal({
  isOpen,
  userName,
  onSoftDelete,
  onHardDelete,
  onCancel,
  loading = false,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-full">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Delete User</h2>
        </div>

        <p className="text-gray-600 mb-4">
          You are about to delete <strong>{userName}</strong>. Please choose how you want to proceed:
        </p>

        <div className="space-y-3 mb-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-semibold text-amber-900 mb-1">Soft Delete</h3>
            <p className="text-sm text-amber-800">
              User will be marked as deleted but their data and activity history will be preserved in the system.
            </p>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-900 mb-1">Hard Delete</h3>
            <p className="text-sm text-red-800">
              User and all their associated data will be permanently removed from the system. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onSoftDelete}
            disabled={loading}
            className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Soft Delete (Recommended)'}
          </button>
          <button
            onClick={onHardDelete}
            disabled={loading}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Hard Delete (Permanent)'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
