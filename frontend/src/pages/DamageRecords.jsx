import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { returnApi } from '../api';
import Modal from '../components/Modal';

function DamageRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    damage_level: 'minor',
    compensation_amount: 0,
    damage_description: '',
    handler: ''
  });

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      let params = {};
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;
      const res = await returnApi.listDamages(params);
      setRecords(res.data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadRecords();
  };

  const handleView = (item) => {
    setDetailItem(item);
    setDetailVisible(true);
  };

  const handleEdit = (item) => {
    setDetailItem(item);
    setEditData({
      damage_level: item.damage_level || 'minor',
      compensation_amount: item.compensation_amount || 0,
      damage_description: item.damage_description || '',
      handler: item.handler || ''
    });
    setEditModalVisible(true);
  };

  const handleResolve = async (item) => {
    if (!confirm(`确定处理该破损记录吗？\n赔偿金额：¥${item.compensation_amount}`)) return;
    try {
      await returnApi.resolveDamage(item.id, { handler: '管理员' });
      alert('已处理');
      loadRecords();
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleSaveEdit = async () => {
    try {
      await returnApi.updateDamage(detailItem.id, editData);
      setEditModalVisible(false);
      loadRecords();
    } catch (error) {
      alert('保存失败');
    }
  };

  const getDamageLevelText = (level) => {
    const map = {
      minor: '轻微',
      moderate: '中等',
      severe: '严重'
    };
    return map[level] || level;
  };

  const getDamageLevelTag = (level) => {
    const colorMap = {
      minor: 'green',
      moderate: 'orange',
      severe: 'red'
    };
    return <span className={`tag tag-${colorMap[level] || 'gray'}`}>{getDamageLevelText(level)}</span>;
  };

  const getStatusTag = (status) => {
    const map = {
      pending: { text: '待处理', color: 'orange' },
      resolved: { text: '已处理', color: 'green' },
      waived: { text: '已豁免', color: 'gray' }
    };
    const info = map[status] || { text: status, color: 'gray' };
    return <span className={`tag tag-${info.color}`}>{info.text}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">破损赔偿</h2>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="form-item">
            <input
              type="text"
              className="form-input"
              placeholder="搜索单号/服装名"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
          <div className="form-item">
            <select
              className="form-input"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="resolved">已处理</option>
              <option value="waived">已豁免</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
        </div>

        {loading ? (
          <div>加载中...</div>
        ) : records.length === 0 ? (
          <div className="empty">暂无破损记录</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>破损单号</th>
                <th>服装名称</th>
                <th>批次</th>
                <th>破损数量</th>
                <th>破损程度</th>
                <th>赔偿金额</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>{record.damage_no}</td>
                  <td>{record.costume_name}</td>
                  <td>{record.batch_no || '-'}</td>
                  <td>{record.damaged_quantity}</td>
                  <td>{getDamageLevelTag(record.damage_level)}</td>
                  <td style={{ color: '#ff4d4f', fontWeight: '600' }}>¥{record.compensation_amount}</td>
                  <td>{getStatusTag(record.status)}</td>
                  <td>{dayjs(record.created_at).format('YYYY-MM-DD')}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-default btn-sm" onClick={() => handleView(record)}>详情</button>
                      {record.status === 'pending' && (
                        <>
                          <button className="btn btn-default btn-sm" onClick={() => handleEdit(record)}>编辑</button>
                          <button className="btn btn-success btn-sm" onClick={() => handleResolve(record)}>处理</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>破损赔偿说明</h3>
        <div style={{ color: '#595959', lineHeight: '1.8' }}>
          <p>📌 <strong>轻微破损：</strong>小污渍、轻微勾线等，可修复，按押金的30%赔偿</p>
          <p>📌 <strong>中等破损：</strong>破洞、拉链损坏等，需专业修复，按押金的60%赔偿</p>
          <p>📌 <strong>严重破损：</strong>无法修复或严重影响使用，按押金全额赔偿</p>
          <p>📌 <strong>特殊情况：</strong>可根据实际情况调整赔偿金额，需备注说明</p>
        </div>
      </div>

      <Modal
        title="破损详情"
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        footer={
          <button className="btn btn-default" onClick={() => setDetailVisible(false)}>关闭</button>
        }
      >
        {detailItem && (
          <>
            <div className="detail-row">
              <span className="detail-label">破损单号：</span>
              <span className="detail-value">{detailItem.damage_no}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">关联排期：</span>
              <span className="detail-value">{detailItem.schedule_id || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">服装名称：</span>
              <span className="detail-value">{detailItem.costume_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">批次：</span>
              <span className="detail-value">{detailItem.batch_no || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">破损数量：</span>
              <span className="detail-value">{detailItem.damaged_quantity} 件</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">破损程度：</span>
              <span className="detail-value">{getDamageLevelTag(detailItem.damage_level)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">赔偿金额：</span>
              <span className="detail-value" style={{ color: '#ff4d4f', fontWeight: '600' }}>¥{detailItem.compensation_amount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">状态：</span>
              <span className="detail-value">{getStatusTag(detailItem.status)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">处理人：</span>
              <span className="detail-value">{detailItem.handler || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">破损描述：</span>
              <span className="detail-value">{detailItem.damage_description || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">创建时间：</span>
              <span className="detail-value">{dayjs(detailItem.created_at).format('YYYY-MM-DD HH:mm')}</span>
            </div>
          </>
        )}
      </Modal>

      <Modal
        title="编辑破损记录"
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setEditModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSaveEdit}>保存</button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">破损程度</label>
          <select
            className="form-input"
            value={editData.damage_level}
            onChange={e => setEditData({ ...editData, damage_level: e.target.value })}
          >
            <option value="minor">轻微</option>
            <option value="moderate">中等</option>
            <option value="severe">严重</option>
          </select>
        </div>
        <div className="form-item">
          <label className="form-label">赔偿金额 (元)</label>
          <input
            type="number"
            className="form-input"
            value={editData.compensation_amount}
            onChange={e => setEditData({ ...editData, compensation_amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="form-item">
          <label className="form-label">处理人</label>
          <input
            type="text"
            className="form-input"
            value={editData.handler}
            onChange={e => setEditData({ ...editData, handler: e.target.value })}
          />
        </div>
        <div className="form-item">
          <label className="form-label">破损描述</label>
          <textarea
            className="form-input form-textarea"
            value={editData.damage_description}
            onChange={e => setEditData({ ...editData, damage_description: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}

export default DamageRecords;
