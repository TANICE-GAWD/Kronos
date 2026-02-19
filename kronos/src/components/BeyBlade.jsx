import { useFrame } from "@react-three/fiber";
import React from "react";

const pls_jst_spin_twn_T_T = ({ setElapsed }) => {

  useFrame((state, delta) => {
      setElapsed(prev => prev + delta);
  });

  return null;
};

export default pls_jst_spin_twn_T_T;