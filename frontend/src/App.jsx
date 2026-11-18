import { useEffect, useState } from 'react';
import AdminDashboard from './Admin.jsx';
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  MapPin,
  Menu,
  MessageCircle,
  PackageCheck,
  Phone,
  ShieldCheck,
  Ship,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '260000000000';
const BUSINESS_PHONE = import.meta.env.VITE_BUSINESS_PHONE || '+260 XXX XXX XXX';
const BUSINESS_EMAIL = import.meta.env.VITE_BUSINESS_EMAIL || 'info@bridgewaylogistics.example';
const BUSINESS_ADDRESS = import.meta.env.VITE_BUSINESS_ADDRESS || 'Lusaka, Zambia';

const services = [
  {
    number: '01',
    title: 'Freight forwarding',
    description: 'Practical freight coordination and shipment support, helping your goods move through the right channels.',
    icon: Ship,
  },
  {
    number: '02',
    title: 'Cargo transportation',
    description: 'Dependable road cargo movement for businesses, suppliers and individuals across Lusaka Province.',
    icon: Truck,
  },
  {
    number: '03',
    title: 'Courier services',
    description: 'Convenient collection and delivery solutions for parcels, documents and smaller consignments.',
    icon: PackageCheck,
  },
  {
    number: '04',
    title: 'Warehousing & storage',
    description: 'Storage and handling support to help keep goods organised between collection and delivery.',
    icon: Warehouse,
  },
  {
    number: '05',
    title: 'Customs clearing support',
    description: 'Assistance coordinating customs-related processes and documentation for eligible shipments.',
    icon: ShieldCheck,
  },
  {
    number: '06',
    title: 'Logistics management',
    description: 'A coordinated approach to transport, storage and delivery requirements from one point of contact.',
    icon: Boxes,
  },
];

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  service: '',
  pickupLocation: '',
  deliveryLocation: '',
  cargoDescription: '',
  quantity: '',
  preferredDate: '',
  message: '',
};

function Brand({ light = false }) {
  return (
    <a className={`brand ${light ? 'brand-light' : ''}`} href="#home" aria-label="Bridgeway Logistics home">
      <img className="brand-logo-image" src="/bridgeway-logo.webp" alt="Bridgeway Logistics — bridge and truck logo" />
    </a>
  );
}

function PublicSite() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formState, setFormState] = useState({ status: 'idle', message: '' });

  const whatsappMessage = encodeURIComponent(
    'Hello Bridgeway Logistics, I would like to enquire about your logistics services. Please assist me.',
  );
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${whatsappMessage}`;

  const closeMenu = () => setMenuOpen(false);
  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  async function submitQuote(event) {
    event.preventDefault();
    setFormState({ status: 'submitting', message: '' });

    try {
      const response = await fetch(`${API_BASE}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'We could not submit your request. Please try again.');
      }
      setForm(initialForm);
      setFormState({
        status: 'success',
        message: `Thank you. Your enquiry has been received${data.reference ? ` (Reference: ${data.reference})` : ''}. Our team will get back to you.`,
      });
    } catch (error) {
      setFormState({
        status: 'error',
        message: error.message || 'Something went wrong. Please try again or contact us on WhatsApp.',
      });
    }
  }

  return (
    <div className="site-shell">
      <div className="top-strip">
        <div className="container top-strip-inner">
          <span><MapPin size={14} /> Serving Lusaka Province, Zambia</span>
          <div className="top-strip-right">
            <span><Clock3 size={14} /> Business hours: <b>To be confirmed</b></span>
            <a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, '')}`}><Phone size={14} /> {BUSINESS_PHONE}</a>
          </div>
        </div>
      </div>

      <header className="main-header">
        <div className="container nav-container">
          <Brand />
          <button className="mobile-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
          <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
            <a href="#home" onClick={closeMenu}>Home</a>
            <a href="#about" onClick={closeMenu}>About us</a>
            <a href="#services" onClick={closeMenu}>Services</a>
            <a href="#coverage" onClick={closeMenu}>Our coverage</a>
            <a href="#contact" onClick={closeMenu}>Contact</a>
            <a href="#/track" onClick={closeMenu}>Track shipment</a>
            <a className="nav-quote" href="#quote" onClick={closeMenu}>Request a quote <ArrowUpRight size={16} /></a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-image" />
          <div className="hero-shade" />
          <div className="container hero-content">
            <div className="hero-copy">
              <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> YOUR LOGISTICS PARTNER IN ZAMBIA</div>
              <h1>Moving business <em>forward.</em></h1>
              <p className="hero-description">From freight coordination to the final delivery, we help keep your goods moving with practical logistics solutions built around your business.</p>
              <div className="hero-actions">
                <a className="button button-orange" href="#quote">Request a quote <ArrowUpRight size={17} /></a>
                <a className="button button-outline-light" href="#services">Explore our services <ArrowDownRight size={17} /></a>
              </div>
              <div className="hero-note"><span className="hero-note-dot" /> Proudly focused on Lusaka Province</div>
            </div>
            <div className="hero-side-card">
              <span className="hero-side-icon"><Truck size={22} /></span>
              <span className="hero-side-label">LOCAL KNOWLEDGE</span>
              <strong>Logistics that keeps you moving.</strong>
              <a href="#about">Get to know us <ArrowUpRight size={15} /></a>
            </div>
          </div>
          <div className="hero-bottom container">
            <span>FREIGHT <i /> TRANSPORT <i /> STORAGE <i /> DELIVERY</span>
            <a href="#about">SCROLL TO DISCOVER <ChevronDown size={15} /></a>
          </div>
        </section>

        <section className="intro-band">
          <div className="container intro-grid">
            <div className="intro-heading">A better way to move<br /><span>what matters.</span></div>
            <p>Every delivery is part of a bigger picture. Bridgeway Logistics brings key logistics services together to help businesses and individuals move cargo, manage goods and coordinate deliveries around Lusaka Province.</p>
            <a className="text-link" href="#services">Discover what we do <ArrowUpRight size={17} /></a>
          </div>
        </section>

        <section className="section about-section" id="about">
          <div className="container about-grid">
            <div className="about-visual-wrap">
              <div className="about-photo" role="img" aria-label="Logistics truck transporting cargo on a highway" />
              <div className="about-stamp"><Globe2 size={24} /><span>ROOTED IN<br /><b>ZAMBIA</b></span></div>
              <div className="about-caption"><span>01 / 03</span><span>BUILT AROUND YOUR LOGISTICS NEEDS</span></div>
            </div>
            <div className="about-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> ABOUT BRIDGEWAY</div>
              <h2>Connecting every<br />part of the <em>journey.</em></h2>
              <p className="lead">We believe logistics should make business easier, not more complicated.</p>
              <p>Bridgeway Logistics is a Zambia-focused logistics services business operating primarily in Lusaka Province. We bring together transport, freight, courier, storage and logistics coordination services to support the movement of goods.</p>
              <p>Whether you are moving a consignment, sending a parcel or organising storage, our aim is to provide a responsive point of contact and a solution shaped around your requirements.</p>
              <a className="button button-dark" href="#contact">Talk to our team <ArrowUpRight size={17} /></a>
            </div>
          </div>
        </section>

        <section className="services-section section" id="services">
          <div className="container">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> WHAT WE DO</div>
                <h2>Logistics solutions.<br /><em>One connection.</em></h2>
              </div>
              <p>Flexible services for the movement, handling and coordination of goods. Tell us what you need and we will help you identify the right next step.</p>
            </div>
            <div className="services-grid">
              {services.map(({ number, title, description, icon: Icon }) => (
                <article className="service-card" key={number}>
                  <div className="service-card-top"><span>{number} / 06</span><Icon size={25} strokeWidth={1.7} /></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <a href="#quote" aria-label={`Request a quote for ${title}`}>Enquire about this service <ArrowUpRight size={15} /></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="coverage-section section" id="coverage">
          <div className="container coverage-grid">
            <div className="coverage-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> WHERE WE OPERATE</div>
              <h2>Local focus.<br /><em>Connected service.</em></h2>
              <p>Our current operating focus is Lusaka Province, Zambia. Share your collection and delivery locations with us so we can confirm availability and the best way to support your shipment.</p>
              <div className="coverage-location"><span className="location-pin"><MapPin size={19} /></span><span><b>Lusaka Province</b><small>Zambia</small></span></div>
              <a className="text-link" href="#quote">Check service availability <ArrowUpRight size={17} /></a>
            </div>
            <div className="coverage-art">
              <div className="coverage-map-card">
                <div className="map-grid-lines" />
                <div className="map-route route-one" />
                <div className="map-route route-two" />
                <div className="map-pin pin-main"><span /><b>LUSAKA</b></div>
                <div className="map-pin pin-small pin-a"><span /></div>
                <div className="map-pin pin-small pin-b"><span /></div>
                <div className="map-pin pin-small pin-c"><span /></div>
                <div className="map-label label-one">LUSAKA PROVINCE</div>
                <div className="map-label label-two">ZAMBIA</div>
                <div className="map-legend"><i /> PRIMARY SERVICE AREA</div>
              </div>
              <div className="coverage-art-caption">SERVICE AREA INDICATIVE — CONFIRM EACH ROUTE WITH OUR TEAM</div>
            </div>
          </div>
        </section>

        <section className="quote-section section" id="quote">
          <div className="container quote-grid">
            <div className="quote-copy">
              <div className="eyebrow eyebrow-light"><span className="eyebrow-line" /> LET'S GET MOVING</div>
              <h2>Tell us what<br />you need to <em>move.</em></h2>
              <p>Send us a few details about your shipment or logistics requirement. Our team can review your request and get in touch to discuss the next steps.</p>
              <div className="quote-contact-list">
                <a href={whatsappHref} target="_blank" rel="noreferrer"><span><MessageCircle size={19} /></span><span><small>WHATSAPP</small><b>{BUSINESS_PHONE}</b></span><ArrowUpRight size={16} /></a>
                <a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, '')}`}><span><Phone size={18} /></span><span><small>CALL OUR TEAM</small><b>{BUSINESS_PHONE}</b></span><ArrowUpRight size={16} /></a>
                <a href={`mailto:${BUSINESS_EMAIL}`}><span><MessageCircle size={18} /></span><span><small>EMAIL</small><b>{BUSINESS_EMAIL}</b></span><ArrowUpRight size={16} /></a>
              </div>
            </div>
            <form className="quote-form" onSubmit={submitQuote}>
              <div className="form-heading"><div><span>01 — REQUEST DETAILS</span><h3>Request a quote</h3></div><span className="form-required">* Required fields</span></div>
              {formState.status === 'success' && <div className="form-alert success"><Check size={18} />{formState.message}</div>}
              {formState.status === 'error' && <div className="form-alert error">{formState.message}</div>}
              <div className="form-row">
                <label>Full name *<input name="fullName" value={form.fullName} onChange={updateField} placeholder="Your full name" autoComplete="name" required maxLength="100" /></label>
                <label>Phone number *<input name="phone" value={form.phone} onChange={updateField} placeholder="e.g. +260 97..." autoComplete="tel" required maxLength="30" /></label>
              </div>
              <div className="form-row">
                <label>Email address<input type="email" name="email" value={form.email} onChange={updateField} placeholder="you@example.com" autoComplete="email" maxLength="150" /></label>
                <label>Service required *<select name="service" value={form.service} onChange={updateField} required><option value="">Select a service</option>{services.map((service) => <option value={service.title} key={service.number}>{service.title}</option>)}<option value="Other logistics enquiry">Other logistics enquiry</option></select></label>
              </div>
              <div className="form-row">
                <label>Collection / pickup location *<input name="pickupLocation" value={form.pickupLocation} onChange={updateField} placeholder="Where should we collect?" required maxLength="160" /></label>
                <label>Delivery location *<input name="deliveryLocation" value={form.deliveryLocation} onChange={updateField} placeholder="Where should it go?" required maxLength="160" /></label>
              </div>
              <div className="form-row">
                <label>Cargo / parcel description *<input name="cargoDescription" value={form.cargoDescription} onChange={updateField} placeholder="What are you sending?" required maxLength="250" /></label>
                <label>Quantity / size<input name="quantity" value={form.quantity} onChange={updateField} placeholder="e.g. 4 boxes, 2 tonnes" maxLength="100" /></label>
              </div>
              <div className="form-row form-row-single">
                <label>Preferred date<input type="date" name="preferredDate" value={form.preferredDate} onChange={updateField} min={new Date().toISOString().split('T')[0]} /></label>
              </div>
              <label>Additional information<textarea name="message" value={form.message} onChange={updateField} placeholder="Tell us anything else we should know..." rows="3" maxLength="1500" /></label>
              <div className="form-submit-row"><p>By submitting, you agree that Bridgeway Logistics may contact you about this enquiry.</p><button className="button button-orange" type="submit" disabled={formState.status === 'submitting'}>{formState.status === 'submitting' ? 'Sending...' : 'Send request'} <ArrowUpRight size={17} /></button></div>
              <div className="form-footnote"><ShieldCheck size={15} /> Your enquiry is submitted securely for the team to review.</div>
            </form>
          </div>
        </section>

        <section className="contact-band" id="contact">
          <div className="container contact-band-inner">
            <div><span className="eyebrow eyebrow-light"><span className="eyebrow-line" /> START A CONVERSATION</span><h2>Need to move something?</h2><p>Let's talk about how we can help.</p></div>
            <div className="contact-band-actions"><a className="button button-orange" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Chat on WhatsApp</a><a className="button button-outline-light" href={`mailto:${BUSINESS_EMAIL}`}>Send us an email <ArrowUpRight size={16} /></a></div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-main">
          <div className="footer-brand-col"><Brand light /><p>Moving goods. Connecting businesses. Supporting logistics needs across Lusaka Province, Zambia.</p><a className="footer-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Connect on WhatsApp <ArrowUpRight size={14} /></a></div>
          <div className="footer-links"><h4>EXPLORE</h4><a href="#about">About us</a><a href="#services">Our services</a><a href="#coverage">Service coverage</a><a href="#quote">Request a quote</a></div>
          <div className="footer-links"><h4>OUR SERVICES</h4>{services.slice(0, 4).map((service) => <a href="#services" key={service.number}>{service.title}</a>)}</div>
          <div className="footer-links footer-contact"><h4>CONTACT</h4><span><MapPin size={15} /> {BUSINESS_ADDRESS}</span><a href={`tel:${BUSINESS_PHONE.replace(/[^+\d]/g, '')}`}><Phone size={15} /> {BUSINESS_PHONE}</a><a href={`mailto:${BUSINESS_EMAIL}`}>{BUSINESS_EMAIL}</a><small>Business hours: To be confirmed</small></div>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} Bridgeway Logistics. All rights reserved.</span><span>Website content and contact details subject to confirmation.</span><a href="#home">BACK TO TOP ↑</a></div>
      </footer>

      <a className="floating-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer" aria-label="Chat with Bridgeway Logistics on WhatsApp"><MessageCircle size={24} /><span>Chat with us</span></a>
    </div>
  );
}

function PublicQuotationPage({ token }) {
  const [quotation, setQuotation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(API_BASE + '/quotes/quotation/' + encodeURIComponent(token))
      .then(async (response) => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || 'Quotation unavailable.'); return data.quotation; })
      .then((data) => { if (active) setQuotation(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  if (loading) return <main className="public-quotation-page"><p>Loading your quotation…</p></main>;
  if (error || !quotation) return <main className="public-quotation-page"><div className="public-quotation-card"><p className="admin-eyebrow">BRIDGEWAY LOGISTICS</p><h1>Quotation unavailable</h1><p>{error}</p><a href="/#home">Return to Bridgeway Logistics</a></div></main>;
  return <main className="public-quotation-page"><article className="public-quotation-card">
    <header><div><strong>BRIDGEWAY LOGISTICS</strong><span>LOGISTICS QUOTATION</span></div><button onClick={() => window.print()}>Download / print PDF</button></header>
    <p className="admin-eyebrow">YOUR QUOTATION</p><h1>{quotation.reference}</h1>
    <p className="public-quotation-intro">Thank you for considering Bridgeway Logistics. Please review your quotation below.</p>
    <div className="public-quotation-meta"><div><small>Prepared for</small><b>{quotation.customerName}</b></div><div><small>Enquiry reference</small><b>{quotation.enquiryReference}</b></div><div><small>Service</small><b>{quotation.service}</b></div><div><small>Route</small><b>{quotation.pickupLocation} → {quotation.deliveryLocation}</b></div></div>
    <section><h2>Services included</h2><p>{quotation.description}</p></section>
    <div className="public-quotation-total"><small>TOTAL QUOTATION</small><strong>{quotation.currency} {Number(quotation.amount).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
    {quotation.terms && <section><h2>Terms and conditions</h2><p>{quotation.terms}</p></section>}
    <p className="public-quotation-validity">Valid until {new Date(quotation.validUntil).toLocaleDateString('en-ZM')}</p>
    <footer>Prepared by Bridgeway Logistics · Lusaka Province, Zambia<br/>Please contact our team if you wish to accept this quotation.</footer>
  </article></main>;
}


function PublicShipmentTrackingPage({ initialTracking = '' }) {
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [shipment, setShipment] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function lookup(event) {
    event?.preventDefault(); setLoading(true); setError(''); setShipment(null);
    const value = trackingNumber.trim().toUpperCase();
    if (!value) { setError('Enter your shipment tracking number.'); setLoading(false); return; }
    try {
      const response = await fetch(API_BASE + '/shipments/track/' + encodeURIComponent(value));
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to find this shipment.');
      setShipment(data.shipment);
      window.history.replaceState(null, '', '/#/track/' + encodeURIComponent(value));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (initialTracking) lookup(); }, [initialTracking]);

  return <main className="public-quotation-page"><article className="public-quotation-card public-tracking-card">
    <header><div><strong>BRIDGEWAY LOGISTICS</strong><span>SHIPMENT TRACKING</span></div><a href="/#home">Back to website</a></header>
    <p className="admin-eyebrow">TRACK YOUR DELIVERY</p><h1>Where is your shipment?</h1>
    <p className="public-quotation-intro">Enter the tracking reference provided by Bridgeway Logistics to view the latest recorded shipment progress.</p>
    <form className="public-tracking-form" onSubmit={lookup}><label>Tracking number<input value={trackingNumber} onChange={(e)=>setTrackingNumber(e.target.value)} placeholder="e.g. BW-M..." required /></label><button className="admin-primary-button" disabled={loading}>{loading?'Searching…':'Track shipment'}</button></form>
    {error && <div className="admin-alert admin-alert-error">{error}</div>}
    {shipment && <section className="public-tracking-result">
      <div className="public-tracking-status"><small>CURRENT STATUS</small><strong>{shipment.status.replaceAll('_',' ')}</strong><span>{shipment.trackingNumber}</span></div>
      <div className="public-quotation-meta"><div><small>Customer</small><b>{shipment.customerName}</b></div><div><small>Service</small><b>{shipment.service||'Logistics service'}</b></div><div><small>Collection</small><b>{shipment.origin}</b></div><div><small>Destination</small><b>{shipment.destination}</b></div><div><small>Current location</small><b>{shipment.currentLocation||'Not yet updated'}</b></div><div><small>Estimated delivery</small><b>{shipment.estimatedDelivery?new Date(shipment.estimatedDelivery).toLocaleDateString('en-ZM'):'To be confirmed'}</b></div></div>
      <h2>Shipment progress</h2>
      <div className="public-tracking-timeline">{[...(shipment.updates||[])].reverse().map((item,index)=><article key={index}><span/><div><b>{item.status.replaceAll('_',' ')}</b><small>{new Date(item.createdAt).toLocaleString('en-ZM')}{item.location?' · '+item.location:''}</small>{item.note&&<p>{item.note}</p>}</div></article>)}</div>
      {shipment.status==='delivered'&&<p className="admin-alert admin-alert-success">This shipment has been marked as delivered.</p>}
    </section>}
    <footer>Tracking information reflects updates recorded by Bridgeway Logistics. For assistance, please contact our team.</footer>
  </article></main>;
}

function App() {
  const trackingMatch = window.location.hash.match(/^#\/track(?:\/([^/]+))?$/);
  if (trackingMatch) return <PublicShipmentTrackingPage initialTracking={trackingMatch[1] ? decodeURIComponent(trackingMatch[1]) : ''} />;
  const quotationMatch = window.location.hash.match(/^#\/quotation\/([a-f0-9]{64})$/);
  if (quotationMatch) return <PublicQuotationPage token={quotationMatch[1]} />;
  return window.location.hash.startsWith('#/admin') ? <AdminDashboard /> : <PublicSite />;
}

export default App;
