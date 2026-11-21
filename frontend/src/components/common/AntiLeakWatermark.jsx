import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Enterprise Anti-Leak Dynamic Watermark
 * 
 * Features:
 * 1. Tiled Multi-Angle Grid: Repeating diagonal watermark overlay covering 100% of viewport.
 * 2. Roaming Dynamic Badge: Smooth hardware-accelerated floating capsule with live second-precision clock.
 * 3. Anti-Tamper Shield: MutationObserver detects DevTools deletions, display:none, opacity:0 and restores instantly.
 * 4. Print Protection: Injects @media print stylesheet blocking unauthorized screen prints.
 * 5. Transparent Usability: pointer-events: none ensures zero friction for test-taking.
 */
const AntiLeakWatermark = ({
  candidate,
  examTitle = 'Online Examination',
  institutionName = 'ExamMatrix Institute',
  attemptId = 'N/A',
  opacity = 0.075,
  showFloatingBadge = true,
  onTamperDetected
}) => {
  const containerRef = useRef(null);
  const [liveTimestamp, setLiveTimestamp] = useState(() => new Date().toLocaleString());
  const [tamperCount, setTamperCount] = useState(0);

  // Extract candidate details with fallbacks
  const candidateName = candidate?.name || 'Authorized Candidate';
  const candidateRoll = candidate?.roll_no || candidate?.student_id || 'ID-PENDING';
  const candidateEmail = candidate?.email || 'confidential@exammatrix.internal';
  const candidateIp = candidate?.ip_address || '127.0.0.1';

  // Live second ticking for watermarks (guarantees camera capture timestamp verification)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setLiveTimestamp(now.toLocaleDateString() + ' ' + now.toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Anti-Tamper Shield: MutationObserver detects DevTools styling overrides or node removals
  useEffect(() => {
    const targetNode = containerRef.current;
    if (!targetNode) return;

    const enforceStyles = () => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      const computed = window.getComputedStyle(el);
      if (
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        parseFloat(computed.opacity) === 0 ||
        computed.pointerEvents !== 'none'
      ) {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        setTamperCount(prev => prev + 1);
        if (onTamperDetected) {
          onTamperDetected({ reason: 'Style mutation detected' });
        }
      }
    };

    const observer = new MutationObserver((mutations) => {
      let isTampered = false;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          enforceStyles();
          isTampered = true;
        }
        if (mutation.type === 'childList') {
          // Check if watermark children were removed
          if (targetNode.children.length === 0) {
            setTamperCount(prev => prev + 1);
            isTampered = true;
          }
        }
      }
      if (isTampered && onTamperDetected) {
        onTamperDetected({ reason: 'DOM mutation or node tampering detected' });
      }
    });

    observer.observe(targetNode, {
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [tamperCount, onTamperDetected]);

  // Intercept unauthorized Print and Screenshot hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Intercept Ctrl+P / Cmd+P (Print to PDF / Printer)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        if (onTamperDetected) {
          onTamperDetected({ reason: 'Print attempt blocked (Ctrl+P / Cmd+P)' });
        }
      }
      // Intercept PrintScreen
      if (e.key === 'PrintScreen') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(`[CONFIDENTIAL ASSESSMENT - ${candidateRoll}] Unauthorized screenshot blocked.`);
        }
        if (onTamperDetected) {
          onTamperDetected({ reason: 'Screen capture key detected (PrintScreen)' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [candidateRoll, onTamperDetected]);

  // Generate repeating watermark cells (grid pattern spanning screens up to 4K resolution)
  const watermarkCells = useMemo(() => {
    const count = 30; // 5x6 grid pattern
    return Array.from({ length: count }, (_, idx) => idx);
  }, []);

  return (
    <div
      ref={containerRef}
      id="anti-leak-watermark-root"
      key={`watermark-shield-${tamperCount}`}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 1050,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {/* Dynamic Keyframes & Print Styles */}
      <style>{`
        @keyframes roamWatermark {
          0% {
            top: 10%;
            left: 8%;
            transform: translate(0, 0) scale(1);
          }
          20% {
            top: 65%;
            left: 15%;
            transform: translate(10px, -15px) scale(1.02);
          }
          40% {
            top: 75%;
            left: 70%;
            transform: translate(-10px, 10px) scale(0.98);
          }
          60% {
            top: 30%;
            left: 65%;
            transform: translate(15px, 5px) scale(1.01);
          }
          80% {
            top: 45%;
            left: 35%;
            transform: translate(-5px, -10px) scale(1);
          }
          100% {
            top: 10%;
            left: 8%;
            transform: translate(0, 0) scale(1);
          }
        }

        .floating-anti-leak-capsule {
          position: fixed;
          pointer-events: none;
          z-index: 1060;
          animation: roamWatermark 32s ease-in-out infinite;
          will-change: top, left, transform;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          #anti-leak-watermark-root {
            visibility: visible !important;
            display: block !important;
            background: white !important;
          }
          .anti-leak-print-warning {
            visibility: visible !important;
            display: flex !important;
            position: fixed !important;
            inset: 0 !important;
            background: #ffffff !important;
            color: #dc2626 !important;
            font-size: 24px !important;
            font-weight: 800 !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            padding: 40px !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* 1. Tiled Multi-Angle Background Watermark Grid */}
      <div
        className="d-flex flex-wrap align-items-center justify-content-around"
        style={{
          position: 'absolute',
          top: '-25%',
          left: '-25%',
          width: '150%',
          height: '150%',
          transform: 'rotate(-22deg)',
          pointerEvents: 'none',
          gap: '30px 40px',
          opacity: opacity
        }}
      >
        {watermarkCells.map((i) => (
          <div
            key={i}
            className="p-3 text-center"
            style={{
              fontFamily: 'monospace, system-ui, sans-serif',
              color: '#334155',
              lineHeight: 1.35,
              fontSize: '0.88rem',
              letterSpacing: '0.04em',
              fontWeight: 600,
              minWidth: '280px',
              maxWidth: '340px'
            }}
          >
            <div className="text-uppercase fw-bold text-dark">
              {candidateName} • {candidateRoll}
            </div>
            <div style={{ fontSize: '0.78rem' }}>
              {candidateEmail}
            </div>
            <div style={{ fontSize: '0.74rem' }}>
              IP: {candidateIp} • Exam: {examTitle}
            </div>
            <div style={{ fontSize: '0.72rem' }} className="text-muted">
              {liveTimestamp} • #{attemptId}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Roaming Dynamic Floating Capsule (Anti-Crop & Live Clock) */}
      {showFloatingBadge && (
        <div className="floating-anti-leak-capsule">
          <div
            className="px-3 py-2 rounded-pill shadow-sm border d-flex align-items-center gap-2"
            style={{
              backgroundColor: 'rgba(248, 250, 252, 0.45)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              borderColor: 'rgba(148, 163, 184, 0.35)',
              fontFamily: 'monospace, sans-serif',
              fontSize: '0.74rem',
              color: 'rgba(30, 41, 59, 0.65)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap'
            }}
          >
            <span
              className="rounded-circle d-inline-block bg-danger"
              style={{ width: '7px', height: '7px', opacity: 0.7 }}
            ></span>
            <span>{candidateName}</span>
            <span className="text-muted">|</span>
            <span>{candidateRoll}</span>
            <span className="text-muted">|</span>
            <span className="text-primary fw-bold">{liveTimestamp.split(' ')[1] || liveTimestamp}</span>
            <span className="text-muted">|</span>
            <span className="text-secondary small">IP: {candidateIp}</span>
          </div>
        </div>
      )}

      {/* 3. Screen Print Lockdown Shield */}
      <div className="anti-leak-print-warning d-none">
        <div>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚠️ RESTRICTED SECURITY VIOLATION</div>
          <div>PRINTING / EXPORTING EXAMINATION QUESTIONS IS STRICTLY PROHIBITED.</div>
          <div style={{ fontSize: '18px', marginTop: '16px', color: '#1e293b' }}>
            Candidate: {candidateName} (Roll: {candidateRoll}) | IP: {candidateIp}
          </div>
          <div style={{ fontSize: '14px', marginTop: '8px', color: '#64748b' }}>
            Event Logged at {liveTimestamp} for Exam: {examTitle}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AntiLeakWatermark;
