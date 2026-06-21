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
  const [detailPayments, setDetailPayments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({
    damage_level: 'minor',
    compensation_amount: 0,
    damage_description: '',
    handler: ''
  });

  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveData, setResolveData] = useState({
    received_amount: 0,
    payment_method: '现金',
    handler: '',
    remark: ''
  });

  const [waiveModalVisible, setWaiveModalVisible] = useState(false);
  const [waiveData, setWaiveData] = useState({
    waive_reason: '',
    handler: ''
  });

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentData, setPaymentData] = useState({
    received_amount: 0,
    payment_method: '现金',
    handler: '',
    remark: ''
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

  const handleView = async (item) => {
    try {
      setDetailLoading(true);
      const detailRes = await returnApi.getDamage(item.id);
      const paymentRes = await returnApi.getDamagePayments(item.id);
      setDetailItem(detailRes.data);
      setDetailPayments(paymentRes.data.payment_records || []);
      setDetailVisible(true);
    } catch (error) {
      alert('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
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

  const handleOpenResolve = (item) => {
    setDetailItem(item);
    const remaining = (item.remaining_amount !== undefined ? item.remaining_amount : (item.compensation_amount - (item.received_amount || 0)));
    setResolveData({
      received_amount: remaining > 0 ? remaining : item.compensation_amount,
      payment_method: '现金',
      handler: '',
      remark: ''
    });
    setResolveModalVisible(true);
  };

  const handleOpenWaive = (item) => {
    setDetailItem(item);
    setWaiveData({
      waive_reason: '',
      handler: ''
    });
    setWaiveModalVisible(true);
  };

  const handleOpenAddPayment = (item) => {
    setDetailItem(item);
    setPaymentData({
      received_amount: (item.remaining_amount || item.compensation_amount || 0) > 0
        ? (item.remaining_amount || item.compensation_amount)
        : 0,
      payment_method: '现金',
      handler: '',
      remark: ''
    });
    setPaymentModalVisible(true);
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

  const handleDoResolve = async () => {
    if (resolveData.received_amount <= 0) {
      alert('收款金额必须大于0');
      return;
    }
    try {
      const res = await returnApi.resolveDamage(detailItem.id, resolveData);
      alert(res.data.message);
      setResolveModalVisible(false);
      loadRecords();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const handleDoWaive = async () => {
    if (!waiveData.waive_reason) {
      alert('请填写豁免原因');
      return;
    }
    if (!confirm(`确定豁免 ¥${detailItem.compensation_amount} 的赔偿吗？`)) return;
    try {
      const res = await returnApi.waiveDamage(detailItem.id, waiveData);
      alert(res.data.message);
      setWaiveModalVisible(false);
      loadRecords();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const handleDoAddPayment = async () => {
    if (paymentData.received_amount <= 0) {
      alert('收款金额必须大于0');
      return;
    }
    try {
      const res = await returnApi.addPayment(detailItem.id, paymentData);
      alert(res.data.message);
      setPaymentModalVisible(false);
      loadRecords();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
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
      partial: { text: '部分处理', color: 'blue' },
      resolved: { text: '已处理', color: 'green' },
      waived: { text: '已豁免', color: 'gray' }
    };
    const info = map[status] || { text: status, color: 'gray' };
    return <span className={`tag tag-${info.color}`}>{info.text}</span>;
  };

  const computePaymentProgress = (item) => {
    const receivable = item.compensation_amount || 0;
    const received = item.received_amount || 0;
    if (item.status === 'waived') {
      return { percent: 100, text: '已豁免' };
    }
    const percent = receivable > 0 ? Math.min(100, Math.round((received / receivable) * 100)) : 0;
    return { percent, text: `${received.toFixed(2)} / ${receivable.toFixed(2)} 元` };
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
              <option value="partial">部分处理</option>
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
                <th>破损情况</th>
                <th>应收赔偿</th>
                <th>收款进度</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => {
                const progress = computePaymentProgress(record);
                return (
                  <tr key={record.id}>
                    <td>{record.damage_no}</td>
                    <td>{record.costume_name}</td>
                    <td>{record.batch_no || '-'}</td>
                    <td>
                      <div>{getDamageLevelTag(record.damage_level)}</div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '2px' }}>
                        {record.damaged_quantity} 件
                      </div>
                    </td>
                    <td style={{ color: '#ff4d4f', fontWeight: 600 }}>
                      ¥{record.compensation_amount}
                    </td>
                    <td style={{ minWidth: '160px' }}>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
                        {progress.text}
                      </div>
                      <div style={{
                        height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${progress.percent}%`,
                          background: record.status === 'waived' ? '#bfbfbf'
                            : record.status === 'resolved' ? '#52c41a' : '#1890ff',
                          borderRadius: '3px'
                        }} />
                      </div>
                    </td>
                    <td>{getStatusTag(record.status)}</td>
                    <td>{dayjs(record.created_at).format('YYYY-MM-DD')}</td>
                    <td>
                      <div className="table-actions" style={{ flexWrap: 'wrap', gap: '4px' }}>
                        <button className="btn btn-default btn-sm" onClick={() => handleView(record)}>详情</button>
                        {(record.status === 'pending' || record.status === 'partial') && (
                          <>
                            <button className="btn btn-default btn-sm" onClick={() => handleEdit(record)}>编辑</button>
                            <button className="btn btn-success btn-sm" onClick={() => handleOpenResolve(record)}>
                              收款处理
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => handleOpenAddPayment(record)}>
                              追加收款
                            </button>
                            <button className="btn btn-default btn-sm" onClick={() => handleOpenWaive(record)}>
                              豁免
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
          <p>📌 <strong>部分处理：</strong>可分多次收款，进度条显示累计收款情况，收齐后自动变为"已处理"</p>
          <p>📌 <strong>豁免：</strong>特殊情况（如友情、误判等）可全额豁免，需填写豁免原因</p>
        </div>
      </div>

      <Modal
        title="破损详情"
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
            <div className="form-row">
              <div style={{ flex: 1 }}>
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
              </div>
              <div style={{ flex: 1 }}>
                <div className="detail-row">
                  <span className="detail-label">破损程度：</span>
                  <span className="detail-value">{getDamageLevelTag(detailItem.damage_level)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">应收赔偿：</span>
                  <span className="detail-value" style={{ color: '#ff4d4f', fontWeight: 700, fontSize: '16px' }}>
                    ¥{detailItem.compensation_amount?.toFixed(2)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">已收款：</span>
                  <span className="detail-value" style={{ color: '#52c41a', fontWeight: 600 }}>
                    ¥{(detailItem.received_amount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">待收款：</span>
                  <span className="detail-value" style={{ color: detailItem.status === 'waived' ? '#bfbfbf' : '#fa8c16', fontWeight: 600 }}>
                    {detailItem.status === 'waived' ? '已豁免' : `¥${(detailItem.remaining_amount || detailItem.compensation_amount - (detailItem.received_amount || 0)).toFixed(2)}`}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">状态：</span>
                  <span className="detail-value">{getStatusTag(detailItem.status)}</span>
                </div>
              </div>
            </div>

            <div className="divider"></div>

            <div className="detail-row">
              <span className="detail-label">破损描述：</span>
              <span className="detail-value">{detailItem.damage_description || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">处理人：</span>
              <span className="detail-value">{detailItem.handler || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">创建时间：</span>
              <span className="detail-value">{dayjs(detailItem.created_at).format('YYYY-MM-DD HH:mm')}</span>
            </div>
            {detailItem.resolved_time && (
              <div className="detail-row">
                <span className="detail-label">处理时间：</span>
                <span className="detail-value">{dayjs(detailItem.resolved_time).format('YYYY-MM-DD HH:mm')}</span>
              </div>
            )}
            {detailItem.status === 'waived' && (
              <>
                <div className="detail-row">
                  <span className="detail-label">豁免原因：</span>
                  <span className="detail-value" style={{ color: '#bfbfbf' }}>{detailItem.waive_reason || '-'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">豁免时间：</span>
                  <span className="detail-value">{dayjs(detailItem.waive_time).format('YYYY-MM-DD HH:mm')}</span>
                </div>
              </>
            )}

            {detailPayments.length > 0 && (
              <>
                <div className="divider"></div>
                <h4 style={{ marginBottom: '12px' }}>收款记录</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>收款金额</th>
                      <th>支付方式</th>
                      <th>处理人</th>
                      <th>收款时间</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPayments.map((p, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td style={{ color: '#52c41a', fontWeight: 600 }}>¥{parseFloat(p.received_amount).toFixed(2)}</td>
                        <td>{p.payment_method}</td>
                        <td>{p.handler || '-'}</td>
                        <td>{dayjs(p.receive_time).format('YYYY-MM-DD HH:mm')}</td>
                        <td>{p.remark || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                      <td style={{ textAlign: 'right' }} colSpan="2">合计收款</td>
                      <td style={{ color: '#52c41a' }} colSpan="4">
                        ¥{detailPayments.reduce((s, p) => s + (parseFloat(p.received_amount) || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </>
        ) : null}
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

      <Modal
        title={`收款处理 - ${detailItem?.damage_no || ''}`}
        visible={resolveModalVisible}
        onClose={() => setResolveModalVisible(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setResolveModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleDoResolve}>确认收款</button>
          </>
        }
      >
        {detailItem && (
          <>
            <div style={{
              background: '#fff7e6', padding: '12px 16px', borderRadius: '4px', marginBottom: '16px'
            }}>
              <div style={{ fontSize: '13px', lineHeight: '2' }}>
                <div>服装：<strong>{detailItem.costume_name}</strong>，{detailItem.damaged_quantity} 件</div>
                <div>应收赔偿：<strong style={{ color: '#ff4d4f' }}>¥{detailItem.compensation_amount?.toFixed(2)}</strong></div>
                {detailItem.received_amount > 0 && (
                  <div>已收款：<strong style={{ color: '#52c41a' }}>¥{detailItem.received_amount?.toFixed(2)}</strong></div>
                )}
              </div>
            </div>

            <div className="form-item">
              <label className="form-label">本次收款金额 (元)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                min="0.01"
                max={(detailItem.remaining_amount !== undefined ? detailItem.remaining_amount : (detailItem.compensation_amount - (detailItem.received_amount || 0))) || detailItem.compensation_amount}
                value={resolveData.received_amount}
                onChange={e => setResolveData({ ...resolveData, received_amount: parseFloat(e.target.value) || 0 })}
              />
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '4px' }}>
                剩余待收款：<strong style={{ color: '#fa8c16' }}>
                  ¥{((detailItem.remaining_amount !== undefined ? detailItem.remaining_amount : (detailItem.compensation_amount - (detailItem.received_amount || 0))) || 0).toFixed(2)}
                </strong>，输入应收金额则一次性结清，输入部分金额则转为"部分处理"状态
              </div>
            </div>

            <div className="form-row">
              <div className="form-item">
                <label className="form-label">支付方式</label>
                <select
                  className="form-input"
                  value={resolveData.payment_method}
                  onChange={e => setResolveData({ ...resolveData, payment_method: e.target.value })}
                >
                  <option value="现金">现金</option>
                  <option value="微信">微信</option>
                  <option value="支付宝">支付宝</option>
                  <option value="银行转账">银行转账</option>
                  <option value="押金抵扣">押金抵扣</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="form-item">
                <label className="form-label">处理人</label>
                <input
                  type="text"
                  className="form-input"
                  value={resolveData.handler}
                  onChange={e => setResolveData({ ...resolveData, handler: e.target.value })}
                  placeholder="管理员"
                />
              </div>
            </div>

            <div className="form-item">
              <label className="form-label">备注</label>
              <input
                type="text"
                className="form-input"
                value={resolveData.remark}
                onChange={e => setResolveData({ ...resolveData, remark: e.target.value })}
              />
            </div>
          </>
        )}
      </Modal>

      <Modal
        title={`追加收款 - ${detailItem?.damage_no || ''}`}
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setPaymentModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleDoAddPayment}>确认收款</button>
          </>
        }
      >
        {detailItem && (
          <>
            <div style={{
              background: '#e6f7ff', padding: '12px 16px', borderRadius: '4px', marginBottom: '16px'
            }}>
              <div style={{ fontSize: '13px', lineHeight: '2' }}>
                <div>应收赔偿：<strong style={{ color: '#ff4d4f' }}>¥{detailItem.compensation_amount?.toFixed(2)}</strong></div>
                <div>已收款：<strong style={{ color: '#52c41a' }}>¥{(detailItem.received_amount || 0).toFixed(2)}</strong></div>
                <div>待收款：<strong style={{ color: '#fa8c16' }}>
                  ¥{((detailItem.remaining_amount !== undefined ? detailItem.remaining_amount : (detailItem.compensation_amount - (detailItem.received_amount || 0))).toFixed(2))}
                </strong></div>
              </div>
            </div>

            <div className="form-item">
              <label className="form-label">本次收款金额 (元) *</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                min="0.01"
                max={detailItem.remaining_amount !== undefined ? detailItem.remaining_amount : (detailItem.compensation_amount - (detailItem.received_amount || 0))}
                value={paymentData.received_amount}
                onChange={e => setPaymentData({ ...paymentData, received_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-row">
              <div className="form-item">
                <label className="form-label">支付方式</label>
                <select
                  className="form-input"
                  value={paymentData.payment_method}
                  onChange={e => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                >
                  <option value="现金">现金</option>
                  <option value="微信">微信</option>
                  <option value="支付宝">支付宝</option>
                  <option value="银行转账">银行转账</option>
                  <option value="押金抵扣">押金抵扣</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div className="form-item">
                <label className="form-label">处理人</label>
                <input
                  type="text"
                  className="form-input"
                  value={paymentData.handler}
                  onChange={e => setPaymentData({ ...paymentData, handler: e.target.value })}
                  placeholder="管理员"
                />
              </div>
            </div>

            <div className="form-item">
              <label className="form-label">备注</label>
              <input
                type="text"
                className="form-input"
                value={paymentData.remark}
                onChange={e => setPaymentData({ ...paymentData, remark: e.target.value })}
              />
            </div>
          </>
        )}
      </Modal>

      <Modal
        title={`豁免赔偿 - ${detailItem?.damage_no || ''}`}
        visible={waiveModalVisible}
        onClose={() => setWaiveModalVisible(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setWaiveModalVisible(false)}>取消</button>
            <button className="btn btn-danger" onClick={handleDoWaive}>确认豁免</button>
          </>
        }
      >
        {detailItem && (
          <>
            <div style={{
              background: '#fff1f0', padding: '12px 16px', borderRadius: '4px', marginBottom: '16px', border: '1px solid #ffa39e'
            }}>
              <div style={{ fontSize: '13px', lineHeight: '2' }}>
                <div>服装：<strong>{detailItem.costume_name}</strong></div>
                <div>破损情况：{getDamageLevelText(detailItem.damage_level)}，{detailItem.damaged_quantity} 件</div>
                <div>豁免金额：<strong style={{ color: '#ff4d4f', fontSize: '16px' }}>
                  ¥{detailItem.compensation_amount?.toFixed(2)}
                </strong></div>
              </div>
            </div>

            <div className="form-item">
              <label className="form-label">处理人</label>
              <input
                type="text"
                className="form-input"
                value={waiveData.handler}
                onChange={e => setWaiveData({ ...waiveData, handler: e.target.value })}
                placeholder="管理员"
              />
            </div>
            <div className="form-item">
              <label className="form-label">豁免原因 *</label>
              <textarea
                className="form-input form-textarea"
                value={waiveData.waive_reason}
                onChange={e => setWaiveData({ ...waiveData, waive_reason: e.target.value })}
                placeholder="请填写豁免原因，如：客户协商、误判、长期合作客户等"
              />
            </div>

            <div style={{
              background: '#fffbe6', padding: '10px', borderRadius: '4px', color: '#d48806', fontSize: '13px', border: '1px solid #ffe58f'
            }}>
              ⚠️ 豁免后此记录将无法再发起收款，请谨慎操作
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default DamageRecords;
