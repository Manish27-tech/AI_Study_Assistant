import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  FileUp,
  HelpCircle,
  Target,
  Sparkles,
  Bot,
  Settings,
  GraduationCap,
  X,
  ChevronLeft,
  Layers,
  BarChart3,
} from "lucide-react";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/upload", label: "Upload & Learn", icon: FileUp },
  { to: "/quiz", label: "Test", icon: HelpCircle },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/gaps", label: "Knowledge Gaps", icon: Target },
  { to: "/recommendations", label: "Recommendations", icon: Sparkles },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/ai-tutor", label: "AI Tutor", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  mobileOpen = false,
  onClose = () => {},
  collapsed = false,
  onToggleCollapse = () => {},
}) {
  return (
    <aside
      className={`sidebar ${mobileOpen ? "open" : ""} ${
        collapsed ? "collapsed" : ""
      }`}
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <GraduationCap size={26} />
        </div>
        <span className="sidebar-brand-text">AI Study Assistant</span>

        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
              onClick={onClose}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button
        type="button"
        className="sidebar-toggle"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronLeft
          size={16}
          className={`sidebar-toggle-icon ${collapsed ? "flipped" : ""}`}
        />
      </button>
    </aside>
  );
}