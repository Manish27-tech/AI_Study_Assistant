import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Sparkles, Zap, Brain, Lock } from "lucide-react";
import "./ModelSelector.css";

export default function ModelSelector({ models, selectedModel, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (model) => {
    onChange(model.id, model.locked);
    setIsOpen(false);
  };

  // Split into Free and Premium
  const freeModels = models.filter((m) => ["groq", "google"].includes(m.provider));
  const premiumModels = models.filter((m) => ["openai", "anthropic"].includes(m.provider));

  const getIcon = (provider, size = 16) => {
    if (provider === "groq") return <Zap size={size} className="ms-icon icon-fast" />;
    if (provider === "openai") return <Brain size={size} className="ms-icon icon-smart" />;
    if (provider === "anthropic") return <Sparkles size={size} className="ms-icon icon-smart" />;
    if (provider === "google") return <Sparkles size={size} className="ms-icon icon-google" />;
    return <Sparkles size={size} />;
  };

  const renderModelOption = (model) => (
    <button
      key={model.id}
      type="button"
      className={`ms-option ${selectedModel === model.id ? "selected" : ""} ${model.locked ? "locked" : ""}`}
      onClick={() => handleSelect(model)}
    >
      <div className="ms-option-icon-wrap">
        {getIcon(model.provider, 18)}
      </div>
      <div className="ms-option-content">
        <div className="ms-option-title">
          {model.label}
          {model.locked && <Lock size={12} className="ms-lock" />}
        </div>
        <div className="ms-option-desc">{model.description}</div>
      </div>
      {selectedModel === model.id && (
        <Check size={16} className="ms-check" />
      )}
    </button>
  );

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        type="button"
        className={`ms-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {getIcon(currentModel?.provider)}
        <span className="ms-trigger-text">{currentModel?.label || "Select Model"}</span>
        <ChevronDown size={14} className={`ms-chevron ${isOpen ? "open" : ""}`} />
      </button>

      {isOpen && (
        <div className="ms-dropdown">
          <div className="ms-dropdown-header">Select a model</div>
          
          {/* --- FREE MODELS --- */}
          {freeModels.length > 0 && (
            <div className="ms-group">
              <div className="ms-group-label">Free Models</div>
              {freeModels.map(renderModelOption)}
            </div>
          )}

          {/* --- PREMIUM MODELS --- */}
          {premiumModels.length > 0 && (
            <div className="ms-group">
              <div className="ms-group-label">Premium Models</div>
              {premiumModels.map(renderModelOption)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}