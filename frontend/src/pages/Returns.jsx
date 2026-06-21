import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { returnApi, scheduleApi, outboundApi } from '../api';
import Modal from '../components/Modal';

function Returns() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('records');
  const [outboundSchedules, setOutboundSchedules] = useState([]);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [outboundDetail, setOutboundDetail] = useState(null);
  const [returnForm, setReturnForm] = useState({
    operator: '',
    remark: '',
    damaged_items: []
  });
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadRecords();
    loadOutboundSchedules();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      let params = {};
      if (keyword) params.keyword = keyword;
      const res = await returnApi.listReturns(params);
      setRecords(res.data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadOutboundSchedules = async () => {
    try {
      const res = await scheduleApi.list({ status: 'outbound' });
      setOutboundSchedules(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewDetail = async (record) => {
    try {
      setDetailLoading(true);
      const res = await returnApi.getReturn(record.id);
      setDetailItem(res.data);
      setDetailVisible(true);
    } catch (error) {
      alert('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = () => {
    loadRecords();
  };

  const handleReturn = async (schedule) => {
    setSelectedSchedule(schedule);
    try {
      const res = await outboundApi.getBySchedule(schedule.id);
      setOutboundDetail(res.data);
      
      const items = res.data.items || [];
      const damagedItems = items.map(item => ({
        batch_id: item.batch_id,
        batch_no: item.batch_no,
        quantity: item.quantity,
        good_quantity: item.quantity,
        damaged_quantity: 0
      }));
      
      setReturnForm({
        operator: '',
        remark: '',
        damaged_items: damagedItems
      });
      setReturnModalVisible(true);
    } catch (error) {
      alert('获取出库明细失败');
    }
  };

  const doReturn = async () => {
    if (!selectedSchedule) return;
    
    for (const item of returnForm.damaged_items) {
      if (item.good_quantity < 0 || item.damaged_quantity < 0) {
        alert(`批次 ${item.batch_no} 的数量不能为负数`);
        return;
      }
      if (item.good_quantity + item.damaged_quantity !== item.quantity) {
        alert(`批次 ${item.batch_no} 的完好件数(${item.good_quantity}) + 破损件数(${item.damaged_quantity}) 必须等于出库数量(${item.quantity})`);
        return;
      }
    }
    
    if (!confirm(`确定为排期"${selectedSchedule.schedule_no}"办理归还吗？`)) return;
    
    try {
      await returnApi.bySchedule(selectedSchedule.id, returnForm);
      alert('归还成功！如有破损，可在"破损赔偿"模块查看待处理记录');
      setReturnModalVisible(false);
      loadRecords();
      loadOutboundSchedules();
    } catch (error) {
      alert(error.response?.data?.error || '归还失败');
    }
  };

  const handleBatchQuantityChange = (batchId, field, value) => {
    const newItems = returnForm.damaged_items.map(item => {
      if (item.batch_id === batchId) {
        const newVal = parseInt(value) || 0;
        if (field === 'good_quantity') {
          return {
            ...item,
            good_quantity: newVal,
            damaged_quantity: item.quantity - newVal
          };
        } else {
          return {
            ...item,
            damaged_quantity: newVal,
            good_quantity: item.quantity - newVal
          };
        }
      }
      return item;
    });
    setReturnForm({ ...returnForm, damaged_items: newItems });
  };

  const viewDetail = (record) => {
    console.log('查看详情', record);
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">归还管理</h2>
      </div>

      <div className="card">
        <div className="tabs">
          <div 
            className={`tab-item ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            归还记录
          </div>
          <div 
            className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            待归还
            {outboundSchedules.length > 0 && (
              <span className="tag tag-orange" style={{ marginLeft: '8px' }}>{outboundSchedules.length}</span>
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
                  placeholder="搜索归还单号/服装名"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
            </div>

            {loading ? (
              <div>加载中...</div>
            ) : records.length === 0 ? (
              <div className="empty">暂无归还记录</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>归还单号</th>
                    <th>关联排期</th>
                    <th>服装名称</th>
                    <th>数量</th>
                    <th>归还时间</th>
                    <th>操作员</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      <td>{record.return_no}</td>
                      <td>{record.schedule_id || '-'}</td>
                      <td>{record.costume_name}</td>
                      <td>{record.total_quantity}</td>
                      <td>{dayjs(record.return_date).format('YYYY-MM-DD HH:mm')}</td>
                      <td>{record.operator || '-'}</td>
                      <td><span className="tag tag-green">已归还</span></td>
                      <td>
                        <button 
                          className="btn btn-default btn-sm"
                          onClick={() => handleViewDetail(record)}
                        >
                          详情
                        </button>
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
              以下为已出库的排期，点击"归还"办理归还手续
            </p>
            {outboundSchedules.length === 0 ? (
              <div className="empty">暂无待归还排期</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>排期号</th>
                    <th>剧团/客户</th>
                    <th>服装名称</th>
                    <th>数量</th>
                    <th>出库批次</th>
                    <th>应还日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {outboundSchedules.map(s => (
                    <tr key={s.id}>
                      <td>{s.schedule_no}</td>
                      <td>{s.troupe_name || '散客'}</td>
                      <td>{s.costume_name}</td>
                      <td>{s.quantity}</td>
                      <td>{s.batch_no || '-'}</td>
                      <td>
                        {dayjs(s.end_date).format('YYYY-MM-DD')}
                        {dayjs().isAfter(dayjs(s.end_date), 'day') && (
                          <span className="tag tag-red" style={{ marginLeft: '8px' }}>已逾期</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleReturn(s)}
                        >
                          归还
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

      <Modal
        title="办理归还"
        visible={returnModalVisible}
        onClose={() => setReturnModalVisible(false)}
        size="large"
        footer={
          <>
            <button className="btn btn-default" onClick={() => setReturnModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={doReturn}>确认归还</button>
          </>
        }
      >
        {selectedSchedule && outboundDetail && (
          <>
            <div className="confirmation-text">
              <strong>排期号：</strong>{selectedSchedule.schedule_no}<br />
              <strong>服装：</strong>{selectedSchedule.costume_name}<br />
              <strong>总数量：</strong>{selectedSchedule.quantity} 件<br />
              <strong>应还日期：</strong>{dayjs(selectedSchedule.end_date).format('YYYY-MM-DD')}
            </div>

            <div className="divider"></div>

            <h4 style={{ marginBottom: '12px' }}>出库批次明细</h4>
            <table className="table" style={{ marginBottom: '16px' }}>
              <thead>
                <tr>
                  <th>批次号</th>
                  <th>效期</th>
                  <th>出库数量</th>
                  <th>完好件数</th>
                  <th>破损件数</th>
                </tr>
              </thead>
              <tbody>
                {returnForm.damaged_items.map(item => (
                  <tr key={item.batch_id}>
                    <td>{item.batch_no}</td>
                    <td>{outboundDetail.items?.find(i => i.batch_id === item.batch_id)?.expiry_date || '-'}</td>
                    <td>{item.quantity}</td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '80px', minWidth: '80px' }}
                        min="0"
                        max={item.quantity}
                        value={item.good_quantity}
                        onChange={e => handleBatchQuantityChange(item.batch_id, 'good_quantity', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '80px', minWidth: '80px' }}
                        min="0"
                        max={item.quantity}
                        value={item.damaged_quantity}
                        onChange={e => handleBatchQuantityChange(item.batch_id, 'damaged_quantity', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="form-item">
              <label className="form-label">操作员</label>
              <input
                type="text"
                className="form-input"
                value={returnForm.operator}
                onChange={e => setReturnForm({ ...returnForm, operator: e.target.value })}
                placeholder="管理员"
              />
            </div>
            <div className="form-item">
              <label className="form-label">归还备注</label>
              <textarea
                className="form-input form-textarea"
                value={returnForm.remark}
                onChange={e => setReturnForm({ ...returnForm, remark: e.target.value })}
                placeholder="如有破损等情况请备注"
              />
            </div>

            <div style={{ background: '#fff7e6', padding: '12px', borderRadius: '4px', fontSize: '13px', color: '#8c8c8c' }}>
              💡 提示：请按实际情况填写每个批次的完好件数和破损件数，二者之和必须等于出库数量。如有破损，系统会自动按每个批次生成破损记录，可在"破损赔偿"模块查看待处理记录。
            </div>
          </>
        )}
      </Modal>

      <Modal
        title="归还详情"
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        size="large"
        footer={
          <button className="btn btn-default" onClick={() => setDetailVisible(false)}>关闭</button>
        }
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : detailItem ? (
          <>
            <div className="detail-row">
              <span className="detail-label">归还单号：</span>
              <span className="detail-value">{detailItem.return_no}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">归还时间：</span>
              <span className="detail-value" style={{ color: '#1890ff', fontWeight: 600 }}>
                {dayjs(detailItem.return_date).format('YYYY-MM-DD HH:mm:ss')}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">操作员：</span>
              <span className="detail-value">{detailItem.operator || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">服装：</span>
              <span className="detail-value">{detailItem.costume_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">总数量：</span>
              <span className="detail-value">{detailItem.total_quantity} 件</span>
            </div>

            {detailItem.schedule && (
              <div style={{
                background: '#e6f7ff', padding: '12px 16px', borderRadius: '4px', margin: '12px 0'
              }}>
                <h4 style={{ marginBottom: '8px' }}>关联排期</h4>
                <div style={{ fontSize: '13px', lineHeight: '2' }}>
                  <div>排期号：<strong>{detailItem.schedule.schedule_no}</strong></div>
                  <div>剧团/客户：{detailItem.schedule.troupe_name}</div>
                  <div>租期：{detailItem.schedule.start_date} ~ {detailItem.schedule.end_date}</div>
                  {detailItem.schedule.contact_person && (
                    <div>联系人：{detailItem.schedule.contact_person} {detailItem.schedule.phone ? `(${detailItem.schedule.phone})` : ''}</div>
                  )}
                </div>
              </div>
            )}

            {detailItem.outbound && (
              <div style={{
                background: '#fff7e6', padding: '12px 16px', borderRadius: '4px', margin: '12px 0'
              }}>
                <h4 style={{ marginBottom: '8px' }}>关联出库</h4>
                <div style={{ fontSize: '13px', lineHeight: '2' }}>
                  <div>出库单号：<strong>{detailItem.outbound.outbound_no}</strong></div>
                  <div>出库时间：{dayjs(detailItem.outbound.outbound_date).format('YYYY-MM-DD HH:mm:ss')}</div>
                  <div>出库操作员：{detailItem.outbound.operator || '-'}</div>
                </div>
              </div>
            )}

            <h4 style={{ margin: '16px 0 12px' }}>归还批次明细</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>批次号</th>
                  <th>效期</th>
                  <th>出库数量</th>
                  <th style={{ background: '#f6ffed' }}>完好件数</th>
                  <th style={{ background: '#fff1f0' }}>破损件数</th>
                </tr>
              </thead>
              <tbody>
                {detailItem.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.batch_no}</td>
                    <td>{dayjs(item.expiry_date).format('YYYY-MM-DD')}</td>
                    <td>{item.quantity}</td>
                    <td style={{ background: '#f6ffed', color: '#52c41a', fontWeight: 600 }}>
                      {item.good_quantity || 0}
                    </td>
                    <td style={{ background: '#fff1f0', color: '#ff4d4f', fontWeight: 600 }}>
                      {item.damaged_quantity || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
              {(() => {
                const totalGood = detailItem.items?.reduce((s, i) => s + (i.good_quantity || 0), 0) || 0;
                const totalDamaged = detailItem.items?.reduce((s, i) => s + (i.damaged_quantity || 0), 0) || 0;
                const totalQty = detailItem.items?.reduce((s, i) => s + i.quantity, 0) || 0;
                return (
                  <tfoot>
                    <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                      <td colSpan="2" style={{ textAlign: 'right' }}>合计</td>
                      <td>{totalQty}</td>
                      <td style={{ color: '#52c41a' }}>{totalGood}</td>
                      <td style={{ color: '#ff4d4f' }}>{totalDamaged}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>

            {detailItem.damages?.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0 }}>破损赔偿记录</h4>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setDetailVisible(false); navigate('/damages'); }}
                  >
                    跳转至破损赔偿模块
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>破损单号</th>
                      <th>批次</th>
                      <th>破损数量</th>
                      <th>破损程度</th>
                      <th>赔偿金额</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItem.damages.map(d => (
                      <tr key={d.id}>
                        <td>{d.damage_no}</td>
                        <td>{d.batch_no || '-'}</td>
                        <td>{d.damaged_quantity} 件</td>
                        <td>
                          {d.damage_level === 'minor' && <span className="tag tag-green">轻微</span>}
                          {d.damage_level === 'moderate' && <span className="tag tag-orange">中等</span>}
                          {d.damage_level === 'severe' && <span className="tag tag-red">严重</span>}
                        </td>
                        <td style={{ color: '#ff4d4f', fontWeight: 600 }}>¥{d.compensation_amount}</td>
                        <td>
                          {d.status === 'pending' && <span className="tag tag-orange">待处理</span>}
                          {d.status === 'resolved' && <span className="tag tag-green">已处理</span>}
                          {d.status === 'waived' && <span className="tag tag-gray">已豁免</span>}
                          {d.status === 'partial' && <span className="tag tag-blue">部分处理</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {detailItem.remark && (
              <div style={{ marginTop: '16px' }}>
                <div className="detail-row">
                  <span className="detail-label">备注：</span>
                  <span className="detail-value">{detailItem.remark}</span>
                </div>
              </div>
            )}
          </>
        ) : null}
      </Modal>
    </div>
  );
}

export default Returns;
