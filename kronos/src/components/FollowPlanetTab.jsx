import React, { useState } from "react";
import "../styles/FollowPlanetTab.css";

const FollowPlanetTab = ({ planets, onPlanetSelect, followedPlanet }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePlanetClick = (planetName) => {
    onPlanetSelect(planetName);
    setIsExpanded(false);
  };

  const handleClearFollow = () => {
    onPlanetSelect(null);
    setIsExpanded(false);
  };

  return (
    <div className="follow-planet-tab">
      <button
        className="tab-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Follow a planet"
      >
        📡 Follow
      </button>

      {isExpanded && (
        <div className="follow-menu">
          <div className="menu-header">
            <span>Select Planet</span>
            {followedPlanet && (
              <span className="following-indicator">
                ✓ Following: {followedPlanet}
              </span>
            )}
          </div>

          <div className="planet-list">
            {planets.map((planet) => (
              <button
                key={planet.name}
                className={`planet-button ${
                  followedPlanet === planet.name ? "active" : ""
                }`}
                onClick={() => handlePlanetClick(planet.name)}
              >
                {planet.name}
              </button>
            ))}
          </div>

          {followedPlanet && (
            <button className="clear-follow-btn" onClick={handleClearFollow}>
              ✕ Clear Follow
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FollowPlanetTab;
