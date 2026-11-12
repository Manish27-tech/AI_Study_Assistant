import { Sparkles, X, Check } from "lucide-react";
import "./PremiumModal.css";

export default function PremiumModal({ isOpen, onClose, modelName }) {
  if (!isOpen) return null;

  return (
    <div className="premium-modal-overlay" onClick={onClose}>
      <div className="premium-modal" onClick={(e) => e.stopPropagation()}>
        <button className="premium-close-btn" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="premium-icon-wrap">
          <Sparkles size={28} />
        </div>

        <h2 className="premium-title">Unlock {modelName}</h2>
        <p className="premium-subtitle">
          You are trying to use a premium model. Upgrade to NovaAI Pro to get access to:
        </p>

        <ul className="premium-features">
          <li><Check size={16} /> OpenAI GPT-4o & GPT-4o Mini</li>
          <li><Check size={16} /> Anthropic Claude 3.5 Sonnet</li>
          <li><Check size={16} /> Unlimited file uploads</li>
          <li><Check size={16} /> Priority response speed</li>
        </ul>

        <div className="premium-pricing">
          <span className="price">$10</span>
          <span className="period">/ month</span>
        </div>

        <button className="premium-btn-primary" onClick={() => alert("Stripe checkout would open here!")}>
          Upgrade to Pro
        </button>
        
        <button className="premium-btn-ghost" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}