import React from 'react';

function Modal({ title, onClose, children, footer, visible, size }) {
  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal ${size === 'large' ? 'modal-lg' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
