import { useFrame } from "@react-three/fiber";
import React from "react";

const AnimationController = ({ isPaused, setElapsed }) => {
  useFrame((state, delta) => {
    if (!isPaused) {
      setElapsed((elapsed) => elapsed + delta);
    }
  });

  return null;
};

export default AnimationController;
