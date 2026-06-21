import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { outboundApi, scheduleApi, costumeApi, batchApi } from '../api';
import Modal from '../components/Modal';

function Outbound() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('records');
  const [schedules, setSchedules] = useState([]);
  const [costumes, setCostumes] = useState([]);
  const [directModalVisible, setDirectModalVisible] = useState(false);
  const [fifoPreview, setFifoPreview] = useState(null);
  
  const [directForm, setDirectForm] = useState({
    costume_id: '',
    costume_name: '',
    quantity: 1,
    operator: '',
    remark: ''
  });

  useEffect(() => {
    loadRecords();
    loadSchedules();
    loadCostumes();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      let params = {};
      if (keyword) params.keyword = keyword;
      const res = await outboundApi.list(params);
      setRecords(res.data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const res = await scheduleApi.list({ status: 'confirmed' });
      setSchedules(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadCostumes = async () => {
    try {
      const res = await costumeApi.list();
      setCostumes(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = () => {
    loadRecords();
  };

  const handleBySchedule = async (schedule) => {
    if (!confirm(`确定要为排期"${schedule.schedule_no}"办理出库吗？\n服装：${schedule.costume_name}，数量：${schedule.quantity}件`)) return;
    try {
      await outboundApi.bySchedule(schedule.id, { operator: '管理员' });
      alert('出库成功！');
      loadRecords();
      loadSchedules();
    } catch (error) {
      alert(error.response?.data?.error || '出库失败');
    }
  };

  const handleDirectOutbound = () => {
    setDirectForm({
      costume_id: '',
      costume_name: '',
      quantity: 1,
      operator: '',
      remark: ''
    });
    setFifoPreview(null);
    setDirectModalVisible(true);
  };

  const handleCostumeChange = async (costumeId) => {
    const costume = costumes.find(c => c.id == costumeId);
    if (costume) {
      setDirectForm({
        ...directForm,
        costume_id: costumeId,
        costume_name: costume.name
      });
    }
    setFifoPreview(null);
  };

  const previewFifo = async () => {
    if (!directForm.costume_id || !directForm.quantity) {
      alert('请选择服装并输入数量');
      return;
    }
    try {
      const res = await outboundApi.previewFifo(directForm.costume_id, directForm.quantity);
      setFifoPreview(res.data);
    } catch (error) {
      setFifoPreview({
        can_outbound: false,
        available_quantity: 0,
        requested_quantity: directForm.quantity,
        batches: []
      });
    }
  };

  const doDirectOutbound = async () => {
    if (!directForm.costume_id || !directForm.quantity) {
      alert('请选择服装并输入数量');
      return;
    }
    if (!fifoPreview?.can_outbound) {
      alert('库存不足，无法出库');
      return;
    }
    try {
      await outboundApi.direct(directForm);
      alert('出库成功！');
      setDirectModalVisible(false);
      loadRecords();
    } catch (error) {
      alert(error.response?.data?.error || '出库失败');
    }
  };

  const confirmedSchedules = schedules.filter(s => s.status === 'confirmed');

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">效期出库</h2>
        <button className="btn btn-primary" onClick={handleDirectOutbound}>
          + 直接出库
        </button>
      </div>

      <div className="card">
        <div className="tabs">
          <div 
            className={`tab-item ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            出库记录
          </div>
          <div 
            className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            待出库排期
            {confirmedSchedules.length > 0 && (
              <span className="tag tag-orange" style={{ marginLeft: '8px' }}>{confirmedSchedules.length}</span>
            )}
          </div>
        </div>

        {activeTab === 'records' ? (
          <>
            <div className="search-bar">
              <div className="form-item">
                <input
                  type="text"
                  className="form-input"
                  placeholder="搜索出库单号/服装名"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
            </div>

            {loading ? (
              <div>加载中...</div>
            ) : records.length === 0 ? (
              <div className="empty">暂无出库记录</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>出库单号</th>
                    <th>关联排期</th>
                    <th>服装名称</th>
                    <th>数量</th>
                    <th>出库时间</th>
                    <th>操作员</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      <td>{record.outbound_no}</td>
                      <td>{record.schedule_id || '-'}</td>
                      <td>{record.costume_name}</td>
                      <td>{record.total_quantity}</td>
                      <td>{dayjs(record.outbound_date).format('YYYY-MM-DD HH:mm')}</td>
                      <td>{record.operator || '-'}</td>
                      <td><span className="tag tag-orange">已出库</span></td>
                      <td>
                        <button className="btn btn-default btn-sm">详情</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <>
            <p style={{ marginBottom: '16px', color: '#8c8c8c' }}>
              以下为已确认的排期，点击"出库"按钮按效期先进先出自动分配批次
            </p>
            {confirmedSchedules.length === 0 ? (
              <div className="empty">暂无待出库排期</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>排期号</th>
                    <th>剧团/客户</th>
                    <th>服装名称</th>
                    <th>数量</th>
                    <th>起租日期</th>
                    <th>归还日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedSchedules.map(s => (
                    <tr key={s.id}>
                      <td>{s.schedule_no}</td>
                      <td>{s.troupe_name || '散客'}</td>
                      <td>{s.costume_name}</td>
                      <td>{s.quantity}</td>
                      <td>{dayjs(s.start_date).format('YYYY-MM-DD')}</td>
                      <td>{dayjs(s.end_date).format('YYYY-MM-DD')}</td>
                      <td>
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleBySchedule(s)}
                        >
                          出库
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>出库规则说明</h3>
        <div style={{ color: '#595959', lineHeight: '1.8' }}>
          <p>📌 <strong>先进先出原则：</strong>系统自动按效期从近到远分配批次，确保临期服装先出库</p>
          <p>📌 <strong>临期预警：</strong>效期不足30天的批次会显示橙色预警标记</p>
          <p>📌 <strong>过期锁定：</strong>已过期的批次自动锁定，无法出库</p>
          <p>📌 <strong>手动锁定：</strong>可手动锁定特定批次，锁定后无法出库</p>
          <p>📌 <strong>批量分配：</strong>如单个批次数量不足，系统会自动从多个批次按效期顺序分配</p>
        </div>
      </div>

      <Modal
        title="直接出库"
        visible={directModalVisible}
        onClose={() => setDirectModalVisible(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setDirectModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={doDirectOutbound} disabled={!fifoPreview?.can_outbound}>
              确认出库
            </button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">选择服装 *</label>
          <select
            className="form-input"
            value={directForm.costume_id}
            onChange={e => handleCostumeChange(e.target.value)}
          >
            <option value="">请选择服装</option>
            {costumes.map(c => (
              <option key={c.id} value={c.id}>{c.name} (库存: {c.available_quantity || 0})</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">出库数量 *</label>
            <input
              type="number"
              className="form-input"
              min="1"
              value={directForm.quantity}
              onChange={e => setDirectForm({ ...directForm, quantity: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="form-item">
            <label className="form-label">操作员</label>
            <input
              type="text"
              className="form-input"
              value={directForm.operator}
              onChange={e => setDirectForm({ ...directForm, operator: e.target.value })}
              placeholder="管理员"
            />
          </div>
        </div>
        <div className="form-item">
          <label className="form-label">备注</label>
          <textarea
            className="form-input form-textarea"
            value={directForm.remark}
            onChange={e => setDirectForm({ ...directForm, remark: e.target.value })}
          />
        </div>

        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <button className="btn btn-default" onClick={previewFifo}>
            🔍 预览 FIFO 分配结果
          </button>
        </div>

        {fifoPreview && (
          <div className={`fifo-preview`} style={{ 
            background: fifoPreview.can_outbound ? '#f6ffed' : '#fff1f0',
            borderColor: fifoPreview.can_outbound ? '#b7eb8f' : '#ffa39e'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              {fifoPreview.can_outbound ? '✅ 可以出库 - FIFO 分配结果' : '❌ 库存不足'}
            </div>
            <div style={{ marginBottom: '8px', fontSize: '13px' }}>
              请求数量: {fifoPreview.requested_quantity}，可用数量: {fifoPreview.available_quantity}
            </div>
            {fifoPreview.batches?.length > 0 && (
              <>
                <div style={{ fontSize: '13px', color: '#595959', marginBottom: '4px' }}>分配批次：</div>
                {fifoPreview.batches.map((batch, idx) => (
                  <div key={idx} className="fifo-item">
                    <span>{batch.batch_no}</span>
                    <span>{batch.quantity}件 (效期: {dayjs(batch.expiry_date).format('YYYY-MM-DD')})</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Outbound;
