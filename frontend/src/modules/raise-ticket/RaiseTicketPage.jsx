import { Link } from 'react-router-dom';
import RaiseTicketForm from './RaiseTicketForm.jsx';
import './raise-ticket.css';

/**
 * Standalone Raise Ticket Page.
 * Accessible publicly at `/raise-ticket` without requiring login.
 */
export default function RaiseTicketPage() {
  return (
    <div className="rt-page">
      <div className="rt-container">
        {/* Top Navigation */}
        <div className="rt-nav-top">
          <Link to="/login" className="rt-back-link">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Login</span>
          </Link>

          <span className="rt-portal-badge">Support Portal</span>
        </div>

        {/* Main Form Card */}
        <div className="rt-card">
          <RaiseTicketForm showHeader={true} />
        </div>

        {/* Footer */}
        <footer className="rt-footer">
          <p>© {new Date().getFullYear()} Rambhiya Infotech. All rights reserved.</p>
          <p>For urgent billing or API inquiries, contact support at support@rambhiyainfotech.com</p>
        </footer>
      </div>
    </div>
  );
}
