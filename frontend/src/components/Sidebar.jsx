import React from 'react';
import { NavLink } from 'react-router-dom';

const menuItems = [
  { path: '/', label: '仪表盘', icon: '📊', exact: true },
  { path: '/costumes', label: '服装建档', icon: '👘' },
  { path: '/batches', label: '批次管理', icon: '📦' },
  { path: '/schedules', label: '租赁排期', icon: '📅' },
  { path: '/cycle-rules', label: '周期生成', icon: '🔄' },
  { path: '/outbound', label: '效期出库', icon: '📤' },
  { path: '/returns', label: '归还管理', icon: '📥' },
  { path: '/damages', label: '破损赔偿', icon: '💔' },
  { path: '/troupes', label: '剧团管理', icon: '🎭' },
];

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        🎬 服装租赁系统
      </div>
      <div className="sidebar-menu">
        {menuItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => 
              `menu-item ${isActive ? 'active' : ''}`
            }
          >
            <span style={{ marginRight: '10px' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
