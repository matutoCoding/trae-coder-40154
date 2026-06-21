import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Costumes from './pages/Costumes';
import Batches from './pages/Batches';
import Schedules from './pages/Schedules';
import CycleRules from './pages/CycleRules';
import Outbound from './pages/Outbound';
import Returns from './pages/Returns';
import Troupes from './pages/Troupes';
import DamageRecords from './pages/DamageRecords';

function App() {
  const location = useLocation();
  const [pageTitle, setPageTitle] = useState('仪表盘');

  useEffect(() => {
    const titleMap = {
      '/': '仪表盘',
      '/costumes': '服装建档',
      '/batches': '批次管理',
      '/schedules': '租赁排期',
      '/cycle-rules': '周期生成',
      '/outbound': '效期出库',
      '/returns': '归还管理',
      '/troupes': '剧团管理',
      '/damages': '破损赔偿'
    };
    setPageTitle(titleMap[location.pathname] || '系统');
  }, [location.pathname]);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <div className="header">
          <div className="header-title">{pageTitle}</div>
          <div className="header-user">
            <span>管理员</span>
          </div>
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/costumes" element={<Costumes />} />
            <Route path="/batches" element={<Batches />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/cycle-rules" element={<CycleRules />} />
            <Route path="/outbound" element={<Outbound />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/troupes" element={<Troupes />} />
            <Route path="/damages" element={<DamageRecords />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
