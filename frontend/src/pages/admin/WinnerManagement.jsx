import React, { useState, useEffect, useRef } from 'react';
import { winnerService } from '../../services/winnerService';
import { examService } from '../../services/examService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const WinnerManagement = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [winnerData, setWinnerData] = useState(null);
  const [winnerHistory, setWinnerHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('podium'); // 'podium' | 'history'

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Prize Edit Modal
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [prizeForm, setPrizeForm] = useState({
    pos1_title: '',
    pos1_cash: '',
    pos2_title: '',
    pos2_cash: '',
    pos3_title: '',
    pos3_cash: ''
  });

  // TTS Speech State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    loadExams();
    loadHistory();
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadExamWinners(selectedExamId);
    }
  }, [selectedExamId]);

  const loadExams = async () => {
    try {
      setLoading(true);
      const res = await examService.getExams({ limit: 100 });
      if (res.success && res.exams.length > 0) {
        setExams(res.exams);
        setSelectedExamId(res.exams[0].id.toString());
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load examinations list.');
    } finally {
      setLoading(false);
    }
  };

  const loadExamWinners = async (examId) => {
    try {
      setLoading(true);
      setError(null);
      const res = await winnerService.getWinners(examId);
      if (res.success) {
        setWinnerData(res);
        // Pre-populate prize form
        const p1 = res.prizes?.find((p) => p.position === 1);
        const p2 = res.prizes?.find((p) => p.position === 2);
        const p3 = res.prizes?.find((p) => p.position === 3);
        setPrizeForm({
          pos1_title: p1?.title || 'First Place Gold Trophy',
          pos1_cash: p1?.cash_amount || 500,
          pos2_title: p2?.title || 'Second Place Silver Trophy',
          pos2_cash: p2?.cash_amount || 300,
          pos3_title: p3?.title || 'Third Place Bronze Medal',
          pos3_cash: p3?.cash_amount || 150
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve winners podium data.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await winnerService.getWinnerHistory();
      if (res.success) {
        setWinnerHistory(res.history);
      }
    } catch {
      // Non-critical
    }
  };

  // Officially Announce Winners
  const handleAnnounceWinners = async () => {
    if (!selectedExamId || !winnerData) return;
    if (!window.confirm('Announce Top 3 Winners to all candidates? This will broadcast the results in real time.')) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await winnerService.announceWinners(selectedExamId);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => setSuccessMsg(null), 5000);
        await loadExamWinners(selectedExamId);
        await loadHistory();

        // Automatically trigger voice announcement on official announcement!
        handleVoiceAnnouncement(res.winners, res.exam?.title);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to announce winners.');
    } finally {
      setActionLoading(false);
    }
  };

  // Recalculate Winners
  const handleRecalculate = async () => {
    if (!selectedExamId) return;
    try {
      setActionLoading(true);
      const res = await winnerService.calculateWinners(selectedExamId);
      if (res.success) {
        setWinnerData(res);
        setSuccessMsg('Top 3 winners recalculated using tie-breaker rules.');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to recalculate winners.');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Cash Prizes
  const handleSavePrizes = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const payload = [
        { position: 1, title: prizeForm.pos1_title, cash_amount: parseFloat(prizeForm.pos1_cash) || 0 },
        { position: 2, title: prizeForm.pos2_title, cash_amount: parseFloat(prizeForm.pos2_cash) || 0 },
        { position: 3, title: prizeForm.pos3_title, cash_amount: parseFloat(prizeForm.pos3_cash) || 0 }
      ];

      const res = await winnerService.updatePrizes(selectedExamId, payload);
      if (res.success) {
        setWinnerData(res);
        setShowPrizeModal(false);
        setSuccessMsg('Cash prizes and award titles updated successfully.');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save cash prizes.');
    } finally {
      setActionLoading(false);
    }
  };

  // Text-To-Speech (TTS) Voice Announcement (Section 12)
  const handleVoiceAnnouncement = (winnersList = winnerData?.winners, examTitle = winnerData?.exam?.title) => {
    if (!synthRef.current) {
      alert('Text-to-Speech is not supported in this browser environment.');
      return;
    }

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!winnersList || winnersList.length === 0) {
      alert('No winners available to announce.');
      return;
    }

    const first = winnersList.find((w) => w.position === 1);
    const second = winnersList.find((w) => w.position === 2);
    const third = winnersList.find((w) => w.position === 3);

    const speechScript = `Attention everyone! Announcing the official top 3 winners of ${examTitle}!
      In third place, with ${third?.marksObtained || 0} marks, congratulations to ${third?.studentName || 'our third place candidate'}!
      In second place, with ${second?.marksObtained || 0} marks, congratulations to ${second?.studentName || 'our second place candidate'}!
      And now, the first place grand champion, scoring ${first?.marksObtained || 0} marks, congratulations to ${first?.studentName || 'our champion'}!
      Congratulations to all our distinguished winners!`;

    const utterance = new SpeechSynthesisUtterance(speechScript);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    // Pick an expressive English voice if available
    const voices = synthRef.current.getVoices();
    const chosenVoice = voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find((v) => v.lang.startsWith('en'));
    if (chosenVoice) utterance.voice = chosenVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const formatSeconds = (sec) => {
    if (!sec) return '0s';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const firstPlace = winnerData?.winners?.find((w) => w.position === 1);
  const secondPlace = winnerData?.winners?.find((w) => w.position === 2);
  const thirdPlace = winnerData?.winners?.find((w) => w.position === 3);

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">
            <i className="bi bi-trophy-fill text-warning me-2"></i> Top 3 Winner Announcement Module
          </h2>
          <p className="text-secondary small mb-0">
            Automated podium calculation, configurable cash prize management, live real-time broadcasts, and voice announcements.
          </p>
        </div>

        {/* Global Controls */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {winnerData && (
            <>
              <button
                className={`btn btn-sm fw-bold shadow-sm d-flex align-items-center gap-2 ${
                  isSpeaking ? 'btn-danger' : 'btn-outline-primary'
                }`}
                onClick={() => handleVoiceAnnouncement()}
                title="Speak winner names aloud using HTML5 Speech Synthesis"
              >
                <i className={`bi ${isSpeaking ? 'bi-stop-fill' : 'bi-volume-up-fill fs-6'}`}></i>
                <span>{isSpeaking ? 'Stop Voice Announcement' : 'Voice Announcement (TTS)'}</span>
              </button>

              <button
                className="btn btn-outline-secondary btn-sm shadow-sm d-flex align-items-center gap-1"
                onClick={() => setShowPrizeModal(true)}
              >
                <i className="bi bi-cash-coin text-success"></i>
                <span>Manage Cash Prizes</span>
              </button>

              <button
                className="btn btn-outline-secondary btn-sm shadow-sm d-flex align-items-center gap-1"
                onClick={handleRecalculate}
                disabled={actionLoading}
              >
                <i className="bi bi-arrow-repeat"></i>
                <span>Recalculate</span>
              </button>

              <button
                className={`btn btn-sm fw-bold shadow-sm d-flex align-items-center gap-2 ${
                  winnerData.isAnnounced ? 'btn-success' : 'btn-warning text-dark'
                }`}
                onClick={handleAnnounceWinners}
                disabled={actionLoading || winnerData.isAnnounced}
              >
                <i className={`bi ${winnerData.isAnnounced ? 'bi-check-all' : 'bi-megaphone-fill'}`}></i>
                <span>{winnerData.isAnnounced ? 'Officially Announced' : 'Trigger Live Announcement'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
        </div>
      )}

      {/* EXAM SELECTOR BAR */}
      <div className="card-custom bg-white p-3 mb-4 shadow-sm border">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-5">
            <label className="form-label small fw-bold text-muted mb-1">Select Examination</label>
            <select
              className="form-select form-select-sm fw-semibold text-dark"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.exam_date})
                </option>
              ))}
            </select>
          </div>

          {winnerData && (
            <div className="col-12 col-md-7 d-flex flex-wrap align-items-center justify-content-md-end gap-3 pt-2 pt-md-0">
              <div className="text-muted small">
                Announcement Status:{' '}
                <span
                  className={`badge ${
                    winnerData.isAnnounced
                      ? 'bg-success-subtle text-success border border-success'
                      : 'bg-warning-subtle text-dark border border-warning'
                  }`}
                >
                  <i className={`bi ${winnerData.isAnnounced ? 'bi-broadcast-pin me-1' : 'bi-lock me-1'}`}></i>
                  {winnerData.isAnnounced ? 'Announced to Students' : 'Draft / Unannounced'}
                </span>
              </div>

              {winnerData.announcedAt && (
                <div className="text-muted small">
                  Announced At: <strong className="text-dark">{new Date(winnerData.announcedAt).toLocaleString()}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <ul className="nav nav-pills gap-2 mb-4">
        <li className="nav-item">
          <button
            className={`nav-link btn-sm py-1 px-3 ${activeTab === 'podium' ? 'active' : ''}`}
            onClick={() => setActiveTab('podium')}
          >
            <i className="bi bi-trophy-fill me-1"></i> Interactive Podium & Awards
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link btn-sm py-1 px-3 ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <i className="bi bi-clock-history me-1"></i> Historical Winners ({winnerHistory.length})
          </button>
        </li>
      </ul>

      {loading ? (
        <div className="py-5">
          <LoadingSpinner message="Calculating podium winners & cash awards..." />
        </div>
      ) : activeTab === 'podium' ? (
        /* 3D-STYLE ANIMATED WINNER PODIUM ARENA */
        <div className="card-custom bg-white p-4 p-md-5 mb-4 shadow-sm border text-center position-relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div
            className="position-absolute top-0 start-50 translate-middle-x opacity-10 pointer-events-none"
            style={{ fontSize: '18rem', color: '#f59e0b', zIndex: 0 }}
          >
            <i className="bi bi-trophy-fill"></i>
          </div>

          <div className="position-relative" style={{ zIndex: 1 }}>
            <span className="badge bg-warning text-dark fw-bold px-3 py-1 mb-2">Official Podium</span>
            <h3 className="fw-bold text-dark mb-1">{winnerData?.exam?.title}</h3>
            <p className="text-secondary small mb-5">
              Highest Marks & Fastest Submission Time Tie-Breakers Applied
            </p>

            {/* THE THREE PODIUM PEDESTALS */}
            <div className="row g-4 justify-content-center align-items-end" style={{ minHeight: '380px' }}>
              {/* 2ND PLACE (SILVER PEDESTAL - LEFT) */}
              <div className="col-12 col-md-4 order-2 order-md-1">
                {secondPlace ? (
                  <div className="d-flex flex-column align-items-center">
                    {/* Candidate Badge */}
                    <div
                      className="rounded-circle bg-secondary text-white fw-bold d-flex align-items-center justify-content-center mb-3 shadow"
                      style={{ width: '64px', height: '64px', fontSize: '1.6rem', border: '3px solid #cbd5e1' }}
                    >
                      🥈
                    </div>
                    <h5 className="fw-bold text-dark mb-1">{secondPlace.studentName}</h5>
                    <div className="badge bg-secondary mb-2">2nd Position Runner-Up</div>
                    <div className="small text-muted mb-2">ID: {secondPlace.studentId}</div>

                    {/* Pedestal Block */}
                    <div
                      className="w-100 rounded-top-4 p-4 text-white shadow"
                      style={{
                        background: 'linear-gradient(180deg, #64748b 0%, #475569 100%)',
                        minHeight: '200px'
                      }}
                    >
                      <h4 className="fw-bold mb-1">{secondPlace.marksObtained} Marks</h4>
                      <div className="small text-white-50 mb-3">{formatSeconds(secondPlace.completionSeconds)} Duration</div>

                      <div className="p-2 rounded-3 bg-dark bg-opacity-25 border border-white border-opacity-25">
                        <span className="text-white-50 small d-block" style={{ fontSize: '0.72rem' }}>Prize Award</span>
                        <strong className="text-warning fs-6">{secondPlace.prize?.title || 'Silver Award'}</strong>
                        <div className="fw-bold text-white fs-5 mt-1">${secondPlace.prize?.cashAmount || 0} Cash</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-light rounded-4 text-muted small">No 2nd Place Candidate</div>
                )}
              </div>

              {/* 1ST PLACE (GOLD PEDESTAL - CENTER, TALLEST) */}
              <div className="col-12 col-md-4 order-1 order-md-2" style={{ transform: 'translateY(-15px)' }}>
                {firstPlace ? (
                  <div className="d-flex flex-column align-items-center">
                    {/* Crown Icon */}
                    <i className="bi bi-award-fill text-warning fs-1 mb-1 animate-bounce"></i>

                    {/* Gold Candidate Avatar */}
                    <div
                      className="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center mb-3 shadow-lg"
                      style={{ width: '80px', height: '80px', fontSize: '2.2rem', border: '4px solid #fef08a' }}
                    >
                      🥇
                    </div>
                    <h4 className="fw-bold text-dark mb-1">{firstPlace.studentName}</h4>
                    <span className="badge bg-warning text-dark fw-bold px-3 py-1 mb-2 fs-6 shadow-sm">
                      ★ GRAND CHAMPION ★
                    </span>
                    <div className="small text-muted mb-2">ID: {firstPlace.studentId}</div>

                    {/* Taller Gold Pedestal Block */}
                    <div
                      className="w-100 rounded-top-4 p-4 text-dark shadow-lg border border-warning"
                      style={{
                        background: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 100%)',
                        minHeight: '250px'
                      }}
                    >
                      <h3 className="fw-bold mb-1 text-dark">{firstPlace.marksObtained} Marks</h3>
                      <div className="small text-dark text-opacity-75 mb-3">{formatSeconds(firstPlace.completionSeconds)} Duration</div>

                      <div className="p-2 rounded-3 bg-white bg-opacity-40 border border-dark border-opacity-25 shadow-sm">
                        <span className="text-dark small d-block fw-semibold" style={{ fontSize: '0.75rem' }}>Top Prize Award</span>
                        <strong className="text-dark fs-6">{firstPlace.prize?.title || 'Gold Champion Trophy'}</strong>
                        <div className="fw-bold text-dark fs-4 mt-1">${firstPlace.prize?.cashAmount || 0} Cash</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-light rounded-4 text-muted small">No 1st Place Candidate</div>
                )}
              </div>

              {/* 3RD PLACE (BRONZE PEDESTAL - RIGHT) */}
              <div className="col-12 col-md-4 order-3">
                {thirdPlace ? (
                  <div className="d-flex flex-column align-items-center">
                    <div
                      className="rounded-circle bg-dark text-white fw-bold d-flex align-items-center justify-content-center mb-3 shadow"
                      style={{ width: '64px', height: '64px', fontSize: '1.6rem', border: '3px solid #b45309' }}
                    >
                      🥉
                    </div>
                    <h5 className="fw-bold text-dark mb-1">{thirdPlace.studentName}</h5>
                    <div className="badge bg-dark mb-2">3rd Position Award</div>
                    <div className="small text-muted mb-2">ID: {thirdPlace.studentId}</div>

                    {/* Pedestal Block */}
                    <div
                      className="w-100 rounded-top-4 p-4 text-white shadow"
                      style={{
                        background: 'linear-gradient(180deg, #92400e 0%, #78350f 100%)',
                        minHeight: '170px'
                      }}
                    >
                      <h4 className="fw-bold mb-1">{thirdPlace.marksObtained} Marks</h4>
                      <div className="small text-white-50 mb-3">{formatSeconds(thirdPlace.completionSeconds)} Duration</div>

                      <div className="p-2 rounded-3 bg-dark bg-opacity-25 border border-white border-opacity-25">
                        <span className="text-white-50 small d-block" style={{ fontSize: '0.72rem' }}>Prize Award</span>
                        <strong className="text-warning fs-6">{thirdPlace.prize?.title || 'Bronze Medal'}</strong>
                        <div className="fw-bold text-white fs-5 mt-1">${thirdPlace.prize?.cashAmount || 0} Cash</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-light rounded-4 text-muted small">No 3rd Place Candidate</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* HISTORICAL WINNERS TABLE */
        <div className="card-custom bg-white p-3 shadow-sm border">
          <h5 className="fw-bold text-dark mb-3 p-2 border-bottom">
            <i className="bi bi-clock-history text-primary me-2"></i> Institutional Hall of Fame (Announced Champions)
          </h5>

          {winnerHistory.length === 0 ? (
            <div className="py-5 text-center text-muted">
              <i className="bi bi-trophy fs-1 d-block mb-2 text-secondary opacity-50"></i>
              No historical winner announcements recorded yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th>Position</th>
                    <th>Candidate</th>
                    <th>Examination</th>
                    <th>Score</th>
                    <th>Time</th>
                    <th>Announced At</th>
                  </tr>
                </thead>
                <tbody>
                  {winnerHistory.map((w) => {
                    let badge = <span className="badge bg-warning text-dark fw-bold">🥇 1st Place</span>;
                    if (w.position === 2) badge = <span className="badge bg-secondary text-white fw-bold">🥈 2nd Place</span>;
                    if (w.position === 3) badge = <span className="badge bg-dark text-white fw-bold">🥉 3rd Place</span>;

                    return (
                      <tr key={w.id}>
                        <td>{badge}</td>
                        <td>
                          <div className="fw-bold text-dark">{w.student?.user?.name}</div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                            {w.student?.student_id} • {w.student?.class?.name}
                          </div>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{w.exam?.title}</div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{w.exam?.exam_date}</div>
                        </td>
                        <td className="fw-bold text-primary">{w.marks_obtained} Marks</td>
                        <td className="text-muted small">{formatSeconds(w.completion_time_seconds)}</td>
                        <td className="text-muted small">{new Date(w.announced_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: MANAGE CASH PRIZES */}
      {showPrizeModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-cash-stack text-success me-2"></i> Configure Cash Prizes & Awards
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowPrizeModal(false)}></button>
              </div>

              <form onSubmit={handleSavePrizes}>
                <div className="modal-body p-4">
                  {/* Position 1 */}
                  <div className="p-3 bg-warning-subtle rounded-3 border border-warning mb-3">
                    <h6 className="fw-bold text-dark mb-2">🥇 1st Place (Champion)</h6>
                    <div className="row g-2">
                      <div className="col-8">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Award Title"
                          value={prizeForm.pos1_title}
                          onChange={(e) => setPrizeForm({ ...prizeForm, pos1_title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-4">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="Cash"
                            value={prizeForm.pos1_cash}
                            onChange={(e) => setPrizeForm({ ...prizeForm, pos1_cash: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Position 2 */}
                  <div className="p-3 bg-light rounded-3 border mb-3">
                    <h6 className="fw-bold text-dark mb-2">🥈 2nd Place (Runner-Up)</h6>
                    <div className="row g-2">
                      <div className="col-8">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Award Title"
                          value={prizeForm.pos2_title}
                          onChange={(e) => setPrizeForm({ ...prizeForm, pos2_title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-4">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="Cash"
                            value={prizeForm.pos2_cash}
                            onChange={(e) => setPrizeForm({ ...prizeForm, pos2_cash: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Position 3 */}
                  <div className="p-3 bg-light rounded-3 border">
                    <h6 className="fw-bold text-dark mb-2">🥉 3rd Place</h6>
                    <div className="row g-2">
                      <div className="col-8">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Award Title"
                          value={prizeForm.pos3_title}
                          onChange={(e) => setPrizeForm({ ...prizeForm, pos3_title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-4">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text">$</span>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="Cash"
                            value={prizeForm.pos3_cash}
                            onChange={(e) => setPrizeForm({ ...prizeForm, pos3_cash: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top py-2 d-flex justify-content-between">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowPrizeModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-4 fw-bold" disabled={actionLoading}>
                    {actionLoading ? 'Saving...' : 'Save Cash Prizes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WinnerManagement;
