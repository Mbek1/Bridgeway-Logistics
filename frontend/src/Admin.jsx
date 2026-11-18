import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LogOut, RefreshCw, Search, Truck } from 'lucide-react';

const API = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const STATUSES = ['new', 'contacted', 'quoted', 'closed'];
const dateText = (value) => value ? new Date(value).toLocaleString() : '—';

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('bridgeway_admin_token') || '');
  const [role, setRole] = useState(() => sessionStorage.getItem('bridgeway_admin_role') || 'admin');
  const [displayName, setDisplayName] = useState(() => sessionStorage.getItem('bridgeway_admin_name') || 'Administrator');
  const [activeSection, setActiveSection] = useState('enquiries');
  const [shipments, setShipments] = useState([]);
  const [activityEvents, setActivityEvents] = useState([]);
  const [shipmentDrivers, setShipmentDrivers] = useState([]);
  const [shipmentEnquiries, setShipmentEnquiries] = useState([]);
  const [shipmentForm, setShipmentForm] = useState({ quoteId: '', customerName: '', customerPhone: '', customerEmail: '', service: '', origin: '', destination: '', cargoDescription: '', quantity: '', driverId: '', vehicle: '', estimatedDelivery: '' });
  const [shipmentDrafts, setShipmentDrafts] = useState({});
  const [shipmentBusy, setShipmentBusy] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [employeeForm, setEmployeeForm] = useState({ fullName: '', email: '', phone: '', jobTitle: '', department: '', role: 'viewer', password: '' });
  const [editingEmployeeId, setEditingEmployeeId] = useState('');
  const [employeeBusy, setEmployeeBusy] = useState(false);
  const [email, setEmail] = useState('kezlarmudenda90@gmail.com');
  const [password, setPassword] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [stats, setStats] = useState({ total: 0, newRequests: 0, pendingQuotations: 0, closedRequests: 0, issuedQuotations: 0, quotationIssueRate: 0, monthlyReports: [] });
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalQuotes, setTotalQuotes] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [notes, setNotes] = useState('');
  const [nextStatus, setNextStatus] = useState('new');
  const [quotation, setQuotation] = useState({ reference: '', amount: '', description: '', terms: '', validUntil: '', status: 'draft' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(() => quotes.find((q) => q._id === selectedId) || null, [quotes, selectedId]);

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem('bridgeway_admin_token');
        setToken('');
      }
      throw new Error(data.message || 'Request failed.');
    }
    return data;
  }

  async function loadActivity() {
    try { const data = await request('/admin/activity?limit=200'); setActivityEvents(data.events || []); }
    catch (e) { setError(e.message); }
  }

  async function loadShipments() {
    try {
      const data = await request('/admin/shipments');
      setShipments(data.shipments || []); setShipmentDrivers(data.drivers || []); setShipmentEnquiries(data.enquiries || []);
    } catch (e) { setError(e.message); }
  }

  async function createShipment(event) {
    event.preventDefault(); setShipmentBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/admin/shipments', { method: 'POST', body: JSON.stringify(shipmentForm) });
      setShipments((items) => [data.shipment, ...items]);
      setShipmentForm({ quoteId: '', customerName: '', customerPhone: '', customerEmail: '', service: '', origin: '', destination: '', cargoDescription: '', quantity: '', driverId: '', vehicle: '', estimatedDelivery: '' });
      setNotice('Shipment registered. Tracking number: ' + data.shipment.trackingNumber);
    } catch (e) { setError(e.message); }
    finally { setShipmentBusy(false); }
  }

  async function updateShipment(id, patch) {
    setShipmentBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/admin/shipments/' + id, { method: 'PATCH', body: JSON.stringify(patch) });
      setShipments((items) => items.map((item) => item._id === id ? data.shipment : item));
      setNotice('Shipment ' + data.shipment.trackingNumber + ' updated.');
    } catch (e) { setError(e.message); }
    finally { setShipmentBusy(false); }
  }

  async function loadEmployees() {
    try { const data = await request('/admin/employees'); setEmployees(data.employees || []); }
    catch (e) { setError(e.message); }
  }

  async function saveEmployee(event) {
    event.preventDefault(); setEmployeeBusy(true); setError(''); setNotice('');
    try {
      const path = editingEmployeeId ? '/admin/employees/' + editingEmployeeId : '/admin/employees';
      const data = await request(path, { method: editingEmployeeId ? 'PATCH' : 'POST', body: JSON.stringify(employeeForm) });
      if (editingEmployeeId) setEmployees((items) => items.map((item) => item._id === editingEmployeeId ? data.employee : item));
      else setEmployees((items) => [data.employee, ...items]);
      setEmployeeForm({ fullName: '', email: '', phone: '', jobTitle: '', department: '', role: 'viewer', password: '' });
      setEditingEmployeeId(''); setNotice(editingEmployeeId ? 'Employee account updated.' : 'Employee account created. Share the temporary login details securely with the employee.');
    } catch (e) { setError(e.message); }
    finally { setEmployeeBusy(false); }
  }

  function editEmployee(employee) {
    setEditingEmployeeId(employee._id);
    setEmployeeForm({ fullName: employee.fullName || '', email: employee.email || '', phone: employee.phone || '', jobTitle: employee.jobTitle || '', department: employee.department || '', role: employee.role || 'viewer', password: '' });
    document.getElementById('employee-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function toggleEmployee(employee) {
    try {
      const data = await request('/admin/employees/' + employee._id, { method: 'PATCH', body: JSON.stringify({ active: !employee.active }) });
      setEmployees((items) => items.map((item) => item._id === employee._id ? data.employee : item));
      setNotice(data.employee.active ? 'Employee account activated.' : 'Employee account deactivated.');
    } catch (e) { setError(e.message); }
  }

  async function loadQuotes() {
    setBusy(true); setError(''); setNotice('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'all') params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      const [data, summary] = await Promise.all([request('/admin/quotes?' + params.toString()), request('/admin/stats')]);
      setQuotes(data.quotes || []);
      setTotalQuotes(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      setStats(summary);
      setSelectedId((old) => (data.quotes || []).some((q) => q._id === old) ? old : (data.quotes?.[0]?._id || ''));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (token) { if (activeSection === 'enquiries') loadQuotes(); if (activeSection === 'employees' && role === 'admin') loadEmployees(); if (activeSection === 'shipments') loadShipments(); if (activeSection === 'activity' && role === 'admin') loadActivity(); } }, [token, role, page, pageSize, activeSection]);
  useEffect(() => {
    if (selected) {
      setNotes(selected.internalNotes || '');
      setNextStatus(selected.status || 'new');
      const q = selected.quotation || {};
      setQuotation({
        reference: q.reference || '',
        amount: q.amount ? String(q.amount) : '',
        description: q.description || '',
        terms: q.terms || '',
        validUntil: q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : '',
        status: q.status || 'draft',
      });
    }
  }, [selectedId]);

  async function signIn(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(API + '/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to sign in.');
      sessionStorage.setItem('bridgeway_admin_token', data.token);
      sessionStorage.setItem('bridgeway_admin_role', data.role || 'admin');
      sessionStorage.setItem('bridgeway_admin_name', data.name || data.email);
      setRole(data.role || 'admin'); setDisplayName(data.name || data.email);
      setToken(data.token); setPassword('');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function copyQuotationLink() {
    if (!selected?.quotation?.publicToken) return;
    const link = window.location.origin + '/#/quotation/' + selected.quotation.publicToken;
    try { await navigator.clipboard.writeText(link); setNotice('Customer quotation link copied.'); }
    catch { setNotice('Copy was blocked by the browser. Copy this link: ' + link); }
  }

  async function saveQuote() {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/admin/quotes/' + selected._id, {
        method: 'PATCH', body: JSON.stringify({ status: nextStatus, internalNotes: notes }),
      });
      setQuotes((items) => items.map((q) => q._id === selected._id ? data.quote : q));
      setNotice('Quote request updated.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }


  async function saveQuotation() {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await request('/admin/quotes/' + selected._id + '/quotation', {
        method: 'PATCH',
        body: JSON.stringify({ quotation }),
      });
      setQuotes((items) => items.map((q) => q._id === selected._id ? data.quote : q));
      setQuotation((old) => ({ ...old, reference: data.quote.quotation?.reference || old.reference }));
      const mailStatus = data.email?.status;
      setNotice(quotation.status === 'issued' ? (mailStatus === 'sent' ? 'Quotation issued and emailed to the customer.' : mailStatus === 'not_configured' ? 'Quotation issued, but email is not configured yet. Add the Resend settings in Render.' : mailStatus === 'no_email' ? 'Quotation issued, but this customer did not provide an email address.' : mailStatus === 'failed' ? 'Quotation issued, but the email could not be sent: ' + data.email.error : 'Quotation issued and request marked as quoted.') : 'Quotation draft saved.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function signOut() {
    sessionStorage.removeItem('bridgeway_admin_token');
    sessionStorage.removeItem('bridgeway_admin_role');
    sessionStorage.removeItem('bridgeway_admin_name');
    setToken(''); setQuotes([]); setSelectedId(''); setEmployees([]);
  }

  if (!token) return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={signIn}>
        <a className="admin-back-link" href="/#home"><ArrowLeft size={16} /> Back to website</a>
        <div className="admin-brand-mark"><Truck size={25} /></div>
        <p className="admin-eyebrow">BRIDGEWAY LOGISTICS</p>
        <h1>Staff sign in</h1>
        <p className="admin-muted">Sign in with your Bridgeway Logistics account to access your authorised workspace.</p>
        {error && <div className="admin-alert admin-alert-error">{error}</div>}
        <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        <button className="admin-primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
        <p className="admin-login-footnote">Access is restricted to authorised Bridgeway staff.</p>
      </form>
    </main>
  );

  return (
    <main className="admin-page">
      <header className="admin-header"><div className="admin-header-inner">
        <a className="admin-wordmark" href="/#home"><Truck size={22} /> BRIDGEWAY <span>ADMIN</span></a>
        <div className="admin-header-actions"><span>{displayName} · {role}</span><button onClick={activeSection === 'employees' ? loadEmployees : activeSection === 'shipments' ? loadShipments : activeSection === 'activity' ? loadActivity : loadQuotes} disabled={busy || employeeBusy} aria-label="Refresh current section"><RefreshCw size={16} /></button><button className={activeSection === 'enquiries' ? 'is-active' : ''} onClick={() => { setActiveSection('enquiries'); setError(''); setNotice(''); }}>Enquiries</button><button className={activeSection === 'shipments' ? 'is-active' : ''} onClick={() => { setActiveSection('shipments'); setError(''); setNotice(''); }}>Shipments</button>{role === 'admin' && <><button className={activeSection === 'employees' ? 'is-active' : ''} onClick={() => { setActiveSection('employees'); setError(''); setNotice(''); }}>Employees</button><button className={activeSection === 'activity' ? 'is-active' : ''} onClick={() => { setActiveSection('activity'); setError(''); setNotice(''); }}>Activity Log</button></>}<button onClick={signOut}><LogOut size={16} /> Sign out</button></div>
      </div></header>
      <section className="admin-content">
        {activeSection === 'enquiries' && <>
        <div className="admin-title-row"><div><p className="admin-eyebrow">ENQUIRY MANAGEMENT</p><h1>Quote requests</h1><p className="admin-muted">Review incoming enquiries and manage customer follow-ups.</p></div><span className="admin-count">{quotes.length} shown</span></div>
        <div className="admin-stats-grid">
          <article className="admin-stat-card"><span>Total enquiries</span><strong>{stats.total}</strong></article>
          <article className="admin-stat-card"><span>New requests</span><strong>{stats.newRequests}</strong></article>
          <article className="admin-stat-card"><span>Pending quotations</span><strong>{stats.pendingQuotations}</strong></article>
          <article className="admin-stat-card"><span>Closed requests</span><strong>{stats.closedRequests}</strong></article>
          <article className="admin-stat-card"><span>Quotations issued</span><strong>{stats.issuedQuotations || 0}</strong></article>
          <article className="admin-stat-card"><span>Quotation issue rate</span><strong>{stats.quotationIssueRate || 0}%</strong></article>
        </div>
        <section className="admin-report-section">
          <div className="admin-quotation-heading"><div><p className="admin-eyebrow">BUSINESS PERFORMANCE</p><h3>Monthly enquiry and quotation report</h3></div><span className="admin-count">Last 6 months</span></div>
          <div className="admin-report-chart">{Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - 5 + index, 1); const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'); const item = (stats.monthlyReports || []).find((row) => row._id === key) || {}; const max = Math.max(1, ...(stats.monthlyReports || []).map((row) => row.enquiries || 0)); return <div className="admin-report-month" key={key}><div className="admin-report-bars"><span title={'Enquiries: ' + (item.enquiries || 0)} style={{ height: Math.max(3, ((item.enquiries || 0) / max) * 100) + '%' }} /><i title={'Quotations issued: ' + (item.quotationsIssued || 0)} style={{ height: Math.max(3, ((item.quotationsIssued || 0) / max) * 100) + '%' }} /></div><b>{date.toLocaleString('en', { month: 'short' })}</b><small>{item.enquiries || 0} enquiries · {item.quotationsIssued || 0} issued</small></div>; })}</div>
          <p className="admin-report-legend"><i /> Enquiries <i /> Quotations issued</p>
        </section>
        <div className="admin-toolbar">
          <label className="admin-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadQuotes()} placeholder="Search name, reference, phone…" /></label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
          <button className="admin-secondary-button" onClick={() => page === 1 ? loadQuotes() : setPage(1)} disabled={busy}>Search</button>
        </div>
        {error && <div className="admin-alert admin-alert-error">{error}</div>}
        {notice && <div className="admin-alert admin-alert-success">{notice}</div>}
        <div className="admin-workspace">
          <section className="admin-list-panel">
            <div className="admin-panel-heading"><h2>Enquiries</h2><span>{totalQuotes}</span></div>
            {busy && !quotes.length ? <p className="admin-empty">Loading quote requests…</p> : quotes.length ? quotes.map((q) => (
              <button className={'admin-quote-row ' + (selectedId === q._id ? 'is-selected' : '')} key={q._id} onClick={() => setSelectedId(q._id)}>
                <span className="admin-quote-row-top"><b>{q.fullName}</b><small>{dateText(q.createdAt)}</small></span>
                <span className="admin-quote-reference">{q.reference}</span>
                <span className="admin-quote-row-bottom"><span>{q.service}</span><i className={'admin-status status-' + q.status}>{q.status}</i></span>
              </button>
            )) : <p className="admin-empty">No quote requests match your search.</p>}
            {totalQuotes > 0 && <div className="admin-pagination">
              <div className="admin-pagination-summary">Showing <b>{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalQuotes)}</b> of <b>{totalQuotes}</b> enquiries</div>
              <div className="admin-pagination-controls">
                <label className="admin-page-size">Rows
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                    {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
                <button type="button" className="admin-page-button" onClick={() => setPage(1)} disabled={page <= 1 || busy} aria-label="First page">«</button>
                <button type="button" className="admin-page-button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || busy}>Previous</button>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter((number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1)
                  .map((number, index, visible) => <React.Fragment key={number}>
                    {index > 0 && number - visible[index - 1] > 1 && <span className="admin-page-ellipsis">…</span>}
                    <button type="button" className={'admin-page-button ' + (number === page ? 'is-active' : '')} onClick={() => setPage(number)} disabled={busy} aria-current={number === page ? 'page' : undefined}>{number}</button>
                  </React.Fragment>)}
                <button type="button" className="admin-page-button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || busy}>Next</button>
                <button type="button" className="admin-page-button" onClick={() => setPage(totalPages)} disabled={page >= totalPages || busy} aria-label="Last page">»</button>
              </div>
            </div>}
          </section>
          <section className="admin-detail-panel">
            {selected ? <>
              <div className="admin-panel-heading"><div><p className="admin-eyebrow">QUOTE DETAILS</p><h2>{selected.reference}</h2></div><span className={'admin-status status-' + selected.status}>{selected.status}</span></div>
              <div className="admin-detail-grid">
                <div><small>Customer</small><b>{selected.fullName}</b></div><div><small>Submitted</small><b>{dateText(selected.createdAt)}</b></div>
                <div><small>Phone</small><b><a href={'tel:' + selected.phone}>{selected.phone}</a></b></div><div><small>Email</small><b>{selected.email ? <a href={'mailto:' + selected.email}>{selected.email}</a> : 'Not provided'}</b></div>
                <div><small>Service</small><b>{selected.service}</b></div><div><small>Quantity</small><b>{selected.quantity || 'Not specified'}</b></div>
                <div><small>Pickup location</small><b>{selected.pickupLocation}</b></div><div><small>Delivery location</small><b>{selected.deliveryLocation}</b></div>
                <div><small>Preferred date</small><b>{selected.preferredDate || 'Not specified'}</b></div>
                <div className="admin-detail-wide"><small>Cargo description</small><b>{selected.cargoDescription}</b></div>
                <div className="admin-detail-wide"><small>Customer message</small><p>{selected.message || 'No additional message.'}</p></div>
              </div>
              <section className="admin-quotation-editor">
                <div className="admin-quotation-heading"><div><p className="admin-eyebrow">FORMAL QUOTATION</p><h3>Prepare customer quotation</h3></div><span className="admin-status">{selected.quotation?.status || 'not prepared'}</span></div>
                <p className="admin-quotation-help">Create a priced quotation for this enquiry. Saving as a draft does not mark it as issued. Issuing it changes the request status to quoted.</p>
                <div className="admin-quotation-fields">
                  <label>Quotation reference<input value={quotation.reference} onChange={(e) => setQuotation({ ...quotation, reference: e.target.value })} placeholder="Auto-generated if left blank" maxLength="60" /></label>
                  <label>Amount (ZMW)<input type="number" min="0.01" step="0.01" value={quotation.amount} onChange={(e) => setQuotation({ ...quotation, amount: e.target.value })} placeholder="e.g. 12500.00" required /></label>
                  <label>Valid until<input type="date" value={quotation.validUntil} onChange={(e) => setQuotation({ ...quotation, validUntil: e.target.value })} required /></label>
                  <label>Quotation status<select value={quotation.status} onChange={(e) => setQuotation({ ...quotation, status: e.target.value })}><option value="draft">Draft</option><option value="issued">Issued</option></select></label>
                  <label className="admin-quotation-full">Description / services included<textarea rows="4" maxLength="3000" value={quotation.description} onChange={(e) => setQuotation({ ...quotation, description: e.target.value })} placeholder="Describe the transport, handling, route, or other services covered by this price." required /></label>
                  <label className="admin-quotation-full">Terms and conditions<textarea rows="3" maxLength="3000" value={quotation.terms} onChange={(e) => setQuotation({ ...quotation, terms: e.target.value })} placeholder="Payment terms, exclusions, conditions, and other important notes." /></label>
                </div>
                <div className="admin-quotation-actions">{['admin', 'manager', 'sales'].includes(role) && <button className="admin-primary-button" onClick={saveQuotation} disabled={busy}>Save quotation</button>}{selected.quotation?.reference && <button className="admin-secondary-button" type="button" onClick={() => window.print()}>Download / print PDF</button>}{selected.quotation?.publicToken && <button className="admin-secondary-button" type="button" onClick={copyQuotationLink}>Copy customer link</button>}</div>
                {selected.quotation?.reference && <div className="admin-quotation-print">
                  <div className="admin-print-top"><strong>BRIDGEWAY LOGISTICS</strong><span>QUOTATION</span></div>
                  <p><b>Quotation:</b> {selected.quotation.reference}</p>
                  <p><b>Customer:</b> {selected.fullName}</p>
                  <p><b>Enquiry reference:</b> {selected.reference}</p>
                  <p><b>Service:</b> {selected.service}</p>
                  <p><b>Route:</b> {selected.pickupLocation} → {selected.deliveryLocation}</p>
                  <hr />
                  <h3>Services and pricing</h3><p>{selected.quotation.description}</p>
                  <h2>ZMW {Number(selected.quotation.amount || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                  <p><b>Valid until:</b> {dateText(selected.quotation.validUntil)}</p><p><b>Email notification:</b> {selected.quotation.emailStatus || 'not sent'}{selected.quotation.emailSentAt ? ' · ' + dateText(selected.quotation.emailSentAt) : ''}</p>
                  {selected.quotation.terms && <><h3>Terms and conditions</h3><p>{selected.quotation.terms}</p></>}
                  <p className="admin-print-footer">Prepared by Bridgeway Logistics. Please contact our team to accept this quotation.</p>
                </div>}
              </section>
              {selected.quotationHistory?.length > 0 && <section className="admin-history-section">
                <div className="admin-quotation-heading"><div><p className="admin-eyebrow">RECORD KEEPING</p><h3>Quotation history</h3></div><span className="admin-count">{selected.quotationHistory.length} previous version(s)</span></div>
                {[...selected.quotationHistory].reverse().map((item, index) => <article className="admin-history-item" key={item._id || index}>
                  <div><b>{item.reference || 'Quotation version'}</b><span className="admin-status">{item.status || 'draft'}</span></div>
                  <strong>ZMW {Number(item.amount || 0).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  <small>Saved: {dateText(item.savedAt)} · Valid until: {dateText(item.validUntil)}</small>
                </article>)}
              </section>}
              {selected.activityLog?.length > 0 && <section className="admin-history-section">
                <div className="admin-quotation-heading"><div><p className="admin-eyebrow">AUDIT TRAIL</p><h3>Admin activity</h3></div><span className="admin-count">{selected.activityLog.length} event(s)</span></div>
                {[...selected.activityLog].reverse().map((event, index) => <article className="admin-activity-item" key={event._id || index}>
                  <div><b>{String(event.action || 'activity').replaceAll('_', ' ')}</b><small>{dateText(event.createdAt)} · {event.actor || 'Admin'}</small></div><p>{event.details}</p>
                </article>)}
              </section>}
              {['admin', 'manager', 'operations'].includes(role) && <div className="admin-edit-section">
                <label>Request status<select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
                <label>Internal notes<textarea rows="4" maxLength="3000" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the Bridgeway team. Customers cannot see these." /></label>
                <button className="admin-primary-button" onClick={saveQuote} disabled={busy}>Save changes</button>
              </div>}
            </> : <p className="admin-empty">Select a quote request to view its details.</p>}
          </section>
        </div>
        </>}

        {activeSection === 'shipments' && <>
          <div className="admin-title-row"><div><p className="admin-eyebrow">LOGISTICS OPERATIONS</p><h1>Shipment tracking</h1><p className="admin-muted">Register consignments, assign drivers and keep delivery progress up to date.</p></div><span className="admin-count">{shipments.length} shipment(s)</span></div>
          {error && <div className="admin-alert admin-alert-error">{error}</div>}
          {notice && <div className="admin-alert admin-alert-success">{notice}</div>}
          <section className="admin-report-section">
            <div className="admin-quotation-heading"><div><p className="admin-eyebrow">OPERATIONS OVERVIEW</p><h3>Shipment pipeline</h3></div></div>
            <div className="admin-stats-grid">
              <article className="admin-stat-card"><span>Total shipments</span><strong>{shipments.length}</strong></article>
              <article className="admin-stat-card"><span>In transit</span><strong>{shipments.filter((s) => ['picked_up','in_transit','out_for_delivery'].includes(s.status)).length}</strong></article>
              <article className="admin-stat-card"><span>Awaiting dispatch</span><strong>{shipments.filter((s) => s.status === 'pending').length}</strong></article>
              <article className="admin-stat-card"><span>Delivered</span><strong>{shipments.filter((s) => s.status === 'delivered').length}</strong></article>
            </div>
          </section>
          {['admin','manager','operations'].includes(role) && <form className="admin-employees-section shipment-create-form" onSubmit={createShipment}>
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">NEW CONSIGNMENT</p><h2>Register shipment</h2></div></div>
            <p className="admin-quotation-help">You can link a previously quoted enquiry to automatically fill in its customer and route details, or enter a shipment manually.</p>
            <div className="admin-quotation-fields">
              <label className="admin-quotation-full">Link to an enquiry (optional)<select value={shipmentForm.quoteId} onChange={(e) => { const id=e.target.value; const q=shipmentEnquiries.find((item)=>item._id===id); setShipmentForm((old)=>({...old,quoteId:id,customerName:q?.fullName||old.customerName,customerPhone:q?.phone||old.customerPhone,customerEmail:q?.email||old.customerEmail,service:q?.service||old.service,origin:q?.pickupLocation||old.origin,destination:q?.deliveryLocation||old.destination,cargoDescription:q?.cargoDescription||old.cargoDescription,quantity:q?.quantity||old.quantity})); }}><option value="">Create without linking an enquiry</option>{shipmentEnquiries.map((q)=><option key={q._id} value={q._id}>{q.reference} · {q.fullName} · {q.status}</option>)}</select></label>
              <label>Customer name<input required maxLength="100" value={shipmentForm.customerName} onChange={(e)=>setShipmentForm({...shipmentForm,customerName:e.target.value})}/></label>
              <label>Customer phone<input value={shipmentForm.customerPhone} onChange={(e)=>setShipmentForm({...shipmentForm,customerPhone:e.target.value})}/></label>
              <label>Customer email<input type="email" value={shipmentForm.customerEmail} onChange={(e)=>setShipmentForm({...shipmentForm,customerEmail:e.target.value})}/></label>
              <label>Service<input value={shipmentForm.service} onChange={(e)=>setShipmentForm({...shipmentForm,service:e.target.value})} placeholder="e.g. Cargo transportation"/></label>
              <label>Origin / pickup location<input required value={shipmentForm.origin} onChange={(e)=>setShipmentForm({...shipmentForm,origin:e.target.value})}/></label>
              <label>Destination / delivery location<input required value={shipmentForm.destination} onChange={(e)=>setShipmentForm({...shipmentForm,destination:e.target.value})}/></label>
              <label className="admin-quotation-full">Cargo description<input required maxLength="500" value={shipmentForm.cargoDescription} onChange={(e)=>setShipmentForm({...shipmentForm,cargoDescription:e.target.value})}/></label>
              <label>Quantity / load details<input value={shipmentForm.quantity} onChange={(e)=>setShipmentForm({...shipmentForm,quantity:e.target.value})}/></label>
              <label>Assign driver<select value={shipmentForm.driverId} onChange={(e)=>setShipmentForm({...shipmentForm,driverId:e.target.value})}><option value="">Not assigned</option>{shipmentDrivers.map((d)=><option key={d._id} value={d._id}>{d.fullName}{d.phone?' · '+d.phone:''}</option>)}</select></label>
              <label>Vehicle / registration<input value={shipmentForm.vehicle} onChange={(e)=>setShipmentForm({...shipmentForm,vehicle:e.target.value})} placeholder="e.g. Truck registration"/></label>
              <label>Estimated delivery<input type="date" value={shipmentForm.estimatedDelivery} onChange={(e)=>setShipmentForm({...shipmentForm,estimatedDelivery:e.target.value})}/></label>
            </div>
            <button className="admin-primary-button" disabled={shipmentBusy}>{shipmentBusy?'Registering…':'Register shipment'}</button>
          </form>}
          <section className="admin-shipment-list">
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">LIVE OPERATIONS</p><h2>Registered shipments</h2></div><span>{shipments.length} record(s)</span></div>
            {shipments.length ? shipments.map((s) => {
              const draft=shipmentDrafts[s._id]||{};
              return <article className="admin-shipment-card" key={s._id}>
                <div className="admin-shipment-top"><div><b>{s.trackingNumber}</b><small>{s.customerName} · {s.service||'Logistics service'}</small></div><span className="admin-status">{String(s.status).replaceAll('_',' ')}</span></div>
                <div className="admin-shipment-route"><div><small>ORIGIN</small><b>{s.origin}</b></div><span>→</span><div><small>DESTINATION</small><b>{s.destination}</b></div></div>
                <div className="admin-shipment-meta"><span>Driver: <b>{s.driverName||'Not assigned'}</b></span><span>Vehicle: <b>{s.vehicle||'Not recorded'}</b></span><span>Current location: <b>{s.currentLocation||'Not updated'}</b></span><span>ETA: <b>{s.estimatedDelivery?dateText(s.estimatedDelivery):'Not set'}</b></span></div>
                <div className="admin-shipment-edit">
                  <label>Status<select value={draft.status??s.status} onChange={(e)=>setShipmentDrafts((old)=>({...old,[s._id]:{...old[s._id],status:e.target.value}}))}>{['pending','picked_up','in_transit','at_warehouse','out_for_delivery','delivered','delayed','cancelled'].map((st)=><option key={st} value={st}>{st.replaceAll('_',' ')}</option>)}</select></label>
                  <label>Assign driver<select value={draft.driverId??s.driver??''} onChange={(e)=>setShipmentDrafts((old)=>({...old,[s._id]:{...old[s._id],driverId:e.target.value}}))}><option value="">Not assigned</option>{shipmentDrivers.map((d)=><option key={d._id} value={d._id}>{d.fullName}</option>)}</select></label>
                  <label>Current location<input value={draft.currentLocation??s.currentLocation??''} onChange={(e)=>setShipmentDrafts((old)=>({...old,[s._id]:{...old[s._id],currentLocation:e.target.value}}))} placeholder="e.g. Kafue checkpoint"/></label>
                  <label>Vehicle<input value={draft.vehicle??s.vehicle??''} onChange={(e)=>setShipmentDrafts((old)=>({...old,[s._id]:{...old[s._id],vehicle:e.target.value}}))}/></label>
                  <label>Received by (delivery confirmation)<input value={draft.deliveryRecipient??s.deliveryRecipient??''} onChange={(e)=>setShipmentDrafts((old)=>({...old,[s._id]:{...old[s._id],deliveryRecipient:e.target.value}}))} placeholder="Recipient's full name"/></label>
                  <label>Delivery / update notes<input value={draft.deliveryNotes??s.deliveryNotes??''} onChange={(e)=>setShipmentDrafts((old)=>({...old,[s._id]:{...old[s._id],deliveryNotes:e.target.value}}))} placeholder="Condition of cargo, delivery notes…"/></label>
                </div>
                <div className="admin-shipment-actions">
                  {['admin','manager','operations'].includes(role) && <button className="admin-primary-button" disabled={shipmentBusy} onClick={()=>updateShipment(s._id,{status:draft.status??s.status,driverId:draft.driverId??s.driver??'',currentLocation:draft.currentLocation??s.currentLocation??'',vehicle:draft.vehicle??s.vehicle??'',deliveryRecipient:draft.deliveryRecipient??s.deliveryRecipient??'',deliveryNotes:draft.deliveryNotes??s.deliveryNotes??'',updateNote:draft.deliveryNotes||'Shipment progress updated.'})}>Save shipment update</button>}
                  <button className="admin-secondary-button" type="button" onClick={async()=>{const url=window.location.origin+'/#/track/'+encodeURIComponent(s.trackingNumber); try { await navigator.clipboard.writeText(url); setNotice('Customer tracking link copied.'); } catch { setNotice('Tracking number: '+s.trackingNumber+' · Tracking page: '+url); }}}>Copy tracking number</button>
                </div>
                {s.status==='delivered' && <p className="admin-shipment-delivered">Delivered {dateText(s.deliveredAt)}{s.deliveryRecipient?' · Received by '+s.deliveryRecipient:''}</p>}
                {s.updates?.length>0 && <details className="admin-shipment-history"><summary>Shipment history ({s.updates.length})</summary>{[...s.updates].reverse().map((u,i)=><div key={u._id||i}><b>{String(u.status).replaceAll('_',' ')}</b><small>{dateText(u.createdAt)} · {u.location||'Location not recorded'}</small><p>{u.note}</p></div>)}</details>}
              </article>;
            }) : <p className="admin-empty">No shipments have been registered yet.</p>}
          </section>
        </>}
        {activeSection === 'activity' && role === 'admin' && <section className="admin-history-section">
          <div className="admin-title-row"><div><p className="admin-eyebrow">ACCOUNTABILITY & AUDIT</p><h1>Employee activity</h1><p className="admin-muted">Review who performed important actions across enquiries, quotations, shipments and staff accounts.</p></div><span className="admin-count">{activityEvents.length} event(s)</span></div>
          {error && <div className="admin-alert admin-alert-error">{error}</div>}
          <div className="admin-activity-feed">{activityEvents.length ? activityEvents.map((event) => <article className="admin-activity-item" key={event._id}><div><b>{String(event.action || 'activity').replaceAll('_', ' ')}</b><small>{dateText(event.createdAt)} · {event.actor || 'Unknown user'}</small></div><p>{event.details}</p><small>{event.entityType ? event.entityType.toUpperCase() : 'ACTIVITY'}</small></article>) : <p className="admin-empty">No activity has been recorded yet.</p>}</div>
          <p className="admin-quotation-help">This log includes newly recorded staff and shipment actions, plus enquiry and quotation history already stored by the system.</p>
        </section>}

        {activeSection === 'employees' && role === 'admin' && <section className="admin-employees-section" id="admin-employees">
          <div className="admin-panel-heading"><div><p className="admin-eyebrow">STAFF ACCESS CONTROL</p><h2>Employee management</h2></div><span>{employees.length} account(s)</span></div>
          <p className="admin-quotation-help">Create individual staff accounts, assign permissions and deactivate access when someone leaves the team. Employee passwords are stored as secure hashes.</p>
          <div className="admin-employees-layout">
            <div className="admin-employee-list">
              {employees.length ? employees.map((employee) => <article className="admin-employee-row" key={employee._id}>
                <div><b>{employee.fullName}</b><small>{employee.jobTitle || employee.department || employee.email}</small><small>{employee.email}</small><span className={'admin-status ' + (employee.active ? 'status-quoted' : 'status-closed')}>{employee.active ? 'Active' : 'Inactive'} · {employee.role}</span></div>
                <div className="admin-employee-actions"><button className="admin-secondary-button" onClick={() => editEmployee(employee)}>Edit</button><button className="admin-secondary-button" onClick={() => toggleEmployee(employee)}>{employee.active ? 'Deactivate' : 'Activate'}</button></div>
              </article>) : <p className="admin-empty">No employee accounts have been created yet.</p>}
            </div>
            <form className="admin-edit-section admin-employee-form" id="employee-form" onSubmit={saveEmployee}>
              <h3>{editingEmployeeId ? 'Edit employee' : 'Add employee'}</h3>
              <div className="admin-quotation-fields">
                <label>Full name<input required maxLength="100" value={employeeForm.fullName} onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })} /></label>
                <label>Email address<input required type="email" maxLength="150" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} /></label>
                <label>Phone number<input maxLength="30" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} /></label>
                <label>Job title<input maxLength="100" value={employeeForm.jobTitle} onChange={(e) => setEmployeeForm({ ...employeeForm, jobTitle: e.target.value })} placeholder="e.g. Logistics Coordinator" /></label>
                <label>Department<input maxLength="100" value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} placeholder="e.g. Operations" /></label>
                <label>Access role<select value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}><option value="viewer">Viewer — read-only</option><option value="operations">Operations — update requests and notes</option><option value="sales">Sales — prepare quotations</option><option value="manager">Manager — manage requests and quotations</option></select></label>
                <label className="admin-quotation-full">{editingEmployeeId ? 'Reset password (optional)' : 'Initial password'}<input type="password" minLength="10" autoComplete="new-password" required={!editingEmployeeId} value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} placeholder="At least 10 characters" /></label>
              </div>
              <div className="admin-quotation-actions"><button className="admin-primary-button" disabled={employeeBusy}>{employeeBusy ? 'Saving…' : editingEmployeeId ? 'Save employee' : 'Create employee'}</button>{editingEmployeeId && <button type="button" className="admin-secondary-button" onClick={() => { setEditingEmployeeId(''); setEmployeeForm({ fullName: '', email: '', phone: '', jobTitle: '', department: '', role: 'viewer', password: '' }); }}>Cancel</button>}</div>
              <p className="admin-quotation-help">New employees sign in at this same admin portal using their email and initial password. Give credentials to staff privately.</p>
            </form>
          </div>
        </section>}
      </section>
    </main>
  );
}
