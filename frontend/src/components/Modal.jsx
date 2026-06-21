import React from 'react';

function Modal({ title, onClose, children, footer, visible, size }) {
  if (!visible) return null;

  let sizeClass = '';
  if (size === 'large') sizeClass = 'modal-lg';
  if (size === 'extraLarge') sizeClass = 'modal-xl';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal ${sizeClass}`}
        onClick={e => e.stopPropagation()
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
