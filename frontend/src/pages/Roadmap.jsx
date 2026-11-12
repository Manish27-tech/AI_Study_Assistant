import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { analyzeTopic, getTopicFull } from "../api/client";
import { 
  ArrowLeft, Map, Flag, CheckCircle2, ChevronRight, 
  BookOpen, Target, Rocket, Loader2 
} from "lucide-react";
import "./Roadmap.css";

export default function Roadmap() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [roadmap, setRoadmap] = useState(null);
  const [topicName, setTopicName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadRoadmap();
  }, [topicId]);

  const loadRoadmap = async () => {
    setLoading(true);
    try {
      // Fetch topic details for the name
      const topicRes = await getTopicFull(topicId);
      setTopicName(topicRes.data.topic.name);

      // Fetch the roadmap analysis
      const res = await analyzeTopic(topicId);
      setRoadmap(res.data.analysis);
    } catch (err) {
      setError("Could not load roadmap. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="roadmap-loading">
        <Loader2 className="spin" size={40} />
        <h2>Designing your learning path...</h2>
      </div>
    );
  }

  if (error || !roadmap || !roadmap.requires_roadmap) {
    return (
      <div className="roadmap-error">
        <p>{error || "This topic does not have a roadmap."}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const renderSection = (title, icon, items, colorClass) => {
    if (!items || items.length === 0) return null;

    return (
      <div className={`rm-section ${colorClass}`}>
        <div className="rm-section-head">
          <div className="rm-section-icon">{icon}</div>
          <h2>{title}</h2>
        </div>
        <div className="rm-cards">
          {items.map((item, idx) => (
            <div key={idx} className="rm-card">
              <div className="rm-card-dot" />
              <div className="rm-card-content">
                <h3>{item.name}</h3>
                <p>{item.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="roadmap-page">
      <button className="rm-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back to Topic
      </button>

      <div className="rm-header">
        <div className="rm-header-icon">
          <Map size={32} />
        </div>
        <div>
          <h1>{topicName} Roadmap</h1>
          <p>A complete, step-by-step path from fundamentals to advanced concepts.</p>
        </div>
      </div>

      <div className="rm-timeline">
        {renderSection("Prerequisites", <Flag size={20} />, roadmap.roadmap.prerequisites, "rm-blue")}
        {renderSection("Core Topics", <BookOpen size={20} />, roadmap.roadmap.core, "rm-purple")}
        {renderSection("Advanced Topics", <Target size={20} />, roadmap.roadmap.advanced, "rm-orange")}
        {renderSection("Next Steps", <Rocket size={20} />, roadmap.roadmap.next_steps, "rm-green")}
      </div>
    </div>
  );
}