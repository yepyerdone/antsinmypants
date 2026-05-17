/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

export const Effects: React.FC = () => {
  return (
    <EffectComposer enableNormalPass={false} multisampling={4}>
      {/* Crisp arcade glow for lasers, crystals, and runway edges */}
      <Bloom 
        luminanceThreshold={0.58} 
        mipmapBlur 
        intensity={0.84} 
        radius={0.9}
        levels={8}
      />
      <Vignette eskil={false} offset={0.18} darkness={0.28} blendFunction={BlendFunction.MULTIPLY} />
    </EffectComposer>
  );
};
