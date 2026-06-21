import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { dashboardApi } from '../api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, warningsRes] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.warnings()
      ]);
      setStats(statsRes.data);
      setWarnings(warningsRes.data);
    } catch (error) {
      console.error('加载数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">👘</div>
          <div className="stat-title">服装款式</div>
          <div className="stat-value">{stats?.costumes?.total || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📦</div>
          <div className="stat-title">库存总数</div>
          <div className="stat-value">{stats?.costumes?.total_quantity || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">⏰</div>
          <div className="stat-title">临期批次</div>
          <div className="stat-value" style={{ color: stats?.expiry?.warning > 0 ? '#fa8c16' : '#52c41a' }}>
            {stats?.expiry?.warning || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">⚠️</div>
          <div className="stat-title">已过期</div>
          <div className="stat-value" style={{ color: '#ff4d4f' }}>
            {stats?.expiry?.expired || 0}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">🎭</div>
          <div className="stat-title">合作剧团</div>
          <div className="stat-value">{stats?.troupes?.cooperative || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">📅</div>
          <div className="stat-title">今日排期</div>
          <div className="stat-value">{stats?.schedules?.today || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📤</div>
          <div className="stat-title">在租中</div>
          <div className="stat-value">{stats?.schedules?.outbound || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">💔</div>
          <div className="stat-title">待处理破损</div>
          <div className="stat-value" style={{ color: stats?.damages?.pending > 0 ? '#ff4d4f' : '#52c41a' }}>
            {stats?.damages?.pending || 0}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ gridColumn: 'span 2' }}>
          <div className="stat-icon green">💰</div>
          <div className="stat-title">本月营收</div>
          <div className="stat-value" style={{ color: '#52c41a' }}>
            ¥{(stats?.revenue?.month || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card" style={{ gridColumn: 'span 2' }}>
          <div className="stat-icon purple">🔄</div>
          <div className="stat-title">活跃周期规则</div>
          <div className="stat-value">{stats?.cycle_rules?.active || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="warning-section">
          <div className="warning-section-title">
            <span className="warning-icon orange">⚠️</span>
            临期预警
            <span className="tag tag-orange" style={{ marginLeft: 'auto' }}>
              {warnings?.warning_batches?.length || 0} 个批次
            </span>
          </div>
          {warnings?.warning_batches?.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>服装名称</th>
                  <th>批次号</th>
                  <th>效期</th>
                  <th>剩余天数</th>
                </tr>
              </thead>
              <tbody>
                {warnings.warning_batches.map(batch => (
                  <tr key={batch.id}>
                    <td>{batch.costume_name}</td>
                    <td>{batch.batch_no}</td>
                    <td>{dayjs(batch.expiry_date).format('YYYY-MM-DD')}</td>
                    <td>
                      <span className="tag tag-orange">
                        {batch.days_to_expiry} 天
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">暂无临期批次</div>
          )}
        </div>

        <div className="warning-section">
          <div className="warning-section-title">
            <span className="warning-icon red">🚫</span>
            已过期批次
            <span className="tag tag-red" style={{ marginLeft: 'auto' }}>
              {warnings?.expired_batches?.length || 0} 个批次
            </span>
          </div>
          {warnings?.expired_batches?.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>服装名称</th>
                  <th>批次号</th>
                  <th>过期时间</th>
                  <th>已过期</th>
                </tr>
              </thead>
              <tbody>
                {warnings.expired_batches.map(batch => (
                  <tr key={batch.id}>
                    <td>{batch.costume_name}</td>
                    <td>{batch.batch_no}</td>
                    <td>{dayjs(batch.expiry_date).format('YYYY-MM-DD')}</td>
                    <td>
                      <span className="tag tag-red">
                        {Math.abs(batch.days_to_expiry)} 天
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">暂无过期批次</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
        <div className="warning-section">
          <div className="warning-section-title">
            <span className="warning-icon red">💔</span>
            待处理破损
          </div>
          {warnings?.pending_damages?.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>破损单号</th>
                  <th>服装名称</th>
                  <th>数量</th>
                  <th>赔偿金额</th>
                </tr>
              </thead>
              <tbody>
                {warnings.pending_damages.map(damage => (
                  <tr key={damage.id}>
                    <td>{damage.damage_no}</td>
                    <td>{damage.costume_name}</td>
                    <td>{damage.damaged_quantity}</td>
                    <td>¥{damage.compensation_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">暂无待处理破损</div>
          )}
        </div>

        <div className="warning-section">
          <div className="warning-section-title">
            <span className="warning-icon orange">📅</span>
            今日排期
          </div>
          {warnings?.today_schedules?.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>排期号</th>
                  <th>剧团</th>
                  <th>服装</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {warnings.today_schedules.map(schedule => (
                  <tr key={schedule.id}>
                    <td>{schedule.schedule_no}</td>
                    <td>{schedule.troupe_name || '-'}</td>
                    <td>{schedule.costume_name}</td>
                    <td>
                      <span className={`tag tag-${getStatusColor(schedule.status)}`}>
                        {getStatusText(schedule.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">今日暂无排期</div>
          )}
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  const map = {
    reserved: 'blue',
    confirmed: 'green',
    outbound: 'orange',
    returned: 'purple',
    cancelled: 'gray'
  };
  return map[status] || 'gray';
}

function getStatusText(status) {
  const map = {
    reserved: '已预约',
    confirmed: '已确认',
    outbound: '已出库',
    returned: '已归还',
    cancelled: '已取消'
  };
  return map[status] || status;
}

export default Dashboard;
