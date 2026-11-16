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
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [notes, setNotes] = useState('');
  const [nextStatus, setNextStatus] = useState('new');
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
      const data = await request('/admin/quotes?' + params.toString());
      setQuotes(data.quotes || []);
      setSelectedId((old) => (data.quotes || []).some((q) => q._id === old) ? old : (data.quotes?.[0]?._id || ''));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { if (token) loadQuotes(); }, [token]);
  useEffect(() => {
    if (selected) { setNotes(selected.internalNotes || ''); setNextStatus(selected.status || 'new'); }
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
