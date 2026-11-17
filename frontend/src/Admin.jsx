import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LogOut, RefreshCw, Search, Truck } from 'lucide-react';

const API = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const STATUSES = ['new', 'contacted', 'quoted', 'closed'];
const dateText = (value) => value ? new Date(value).toLocaleString() : '—';

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('bridgeway_admin_token') || '');
  const [email, setEmail] = useState('kezlarmudenda90@gmail.com');
  const [password, setPassword] = useState('');
  const [quotes, setQuotes] = useState([]);
  const [stats, setStats] = useState({ total: 0, newRequests: 0, pendingQuotations: 0, closedRequests: 0, issuedQuotations: 0, quotationIssueRate: 0, monthlyReports: [] });
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
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

  async function loadQuotes() {
    setBusy(true); setError(''); setNotice('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'all') params.set('status', status);
      const [data, summary] = await Promise.all([request('/admin/quotes?' + params.toString()), request('/admin/stats')]);
      setQuotes(data.quotes || []);
      setStats(summary);
      setSelectedId((old) => (data.quotes || []).some((q) => q._id === old) ? old : (data.quotes?.[0]?._id || ''));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (token) loadQuotes(); }, [token]);
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
    setToken(''); setQuotes([]); setSelectedId('');
  }

  if (!token) return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={signIn}>
        <a className="admin-back-link" href="/#home"><ArrowLeft size={16} /> Back to website</a>
        <div className="admin-brand-mark"><Truck size={25} /></div>
        <p className="admin-eyebrow">BRIDGEWAY LOGISTICS</p>
        <h1>Admin sign in</h1>
        <p className="admin-muted">Sign in to review and manage customer quote requests.</p>
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
        <div className="admin-header-actions"><span>{email}</span><button onClick={loadQuotes} disabled={busy} aria-label="Refresh quotes"><RefreshCw size={16} /></button><button onClick={signOut}><LogOut size={16} /> Sign out</button></div>
      </div></header>
      <section className="admin-content">
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
          <button className="admin-secondary-button" onClick={loadQuotes} disabled={busy}>Search</button>
        </div>
        {error && <div className="admin-alert admin-alert-error">{error}</div>}
        {notice && <div className="admin-alert admin-alert-success">{notice}</div>}
        <div className="admin-workspace">
          <section className="admin-list-panel">
            <div className="admin-panel-heading"><h2>Enquiries</h2><span>{quotes.length}</span></div>
            {busy && !quotes.length ? <p className="admin-empty">Loading quote requests…</p> : quotes.length ? quotes.map((q) => (
              <button className={'admin-quote-row ' + (selectedId === q._id ? 'is-selected' : '')} key={q._id} onClick={() => setSelectedId(q._id)}>
                <span className="admin-quote-row-top"><b>{q.fullName}</b><small>{dateText(q.createdAt)}</small></span>
                <span className="admin-quote-reference">{q.reference}</span>
                <span className="admin-quote-row-bottom"><span>{q.service}</span><i className={'admin-status status-' + q.status}>{q.status}</i></span>
              </button>
            )) : <p className="admin-empty">No quote requests match your search.</p>}
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
                <div className="admin-quotation-actions"><button className="admin-primary-button" onClick={saveQuotation} disabled={busy}>Save quotation</button>{selected.quotation?.reference && <button className="admin-secondary-button" type="button" onClick={() => window.print()}>Download / print PDF</button>}{selected.quotation?.publicToken && <button className="admin-secondary-button" type="button" onClick={copyQuotationLink}>Copy customer link</button>}</div>
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
              <div className="admin-edit-section">
                <label>Request status<select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
                <label>Internal notes<textarea rows="4" maxLength="3000" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the Bridgeway team. Customers cannot see these." /></label>
                <button className="admin-primary-button" onClick={saveQuote} disabled={busy}>Save changes</button>
              </div>
            </> : <p className="admin-empty">Select a quote request to view its details.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}
