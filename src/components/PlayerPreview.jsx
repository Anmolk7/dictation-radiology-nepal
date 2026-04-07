import React, { useEffect, useRef } from 'react';

const PlayerPreview = ({ audioBlob }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioBlob]);

  return (
    <div className="player-preview">
      <h3>Playback Preview</h3>
      <audio
        ref={audioRef}
        controls
        style={{ width: '100%', marginBottom: '20px' }}
      />
    </div>
  );
};

export default PlayerPreview;
