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
      {/* Soft sunny bloom */}
      <Bloom 
        luminanceThreshold={0.9} 
        mipmapBlur 
        intensity={0.4} 
        radius={0.8}
        levels={8}
      />
      <Vignette eskil={false} offset={0.2} darkness={0.3} blendFunction={BlendFunction.MULTIPLY} />
    </EffectComposer>
  );
};
