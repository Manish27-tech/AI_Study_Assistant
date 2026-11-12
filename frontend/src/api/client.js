import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// ==================================================
// AUTH
// ==================================================
export const loginOrRegister = (payload) =>
  api.post("/auth/login", payload);

// ==================================================
// STUDENTS
// ==================================================
export const createStudent = (payload) => api.post("/students", payload);
export const getStudents = () => api.get("/students");
export const getStudent = (id) => api.get(`/students/${id}`);
export const updateStudent = (id, payload) => api.put(`/students/${id}`, payload);
export const deleteStudent = (id) => api.delete(`/students/${id}`);
export const exportStudentData = (id) => api.get(`/students/${id}/export`);
export const getProfileStats = (id) => api.get(`/students/${id}/profile-stats`);

// ==================================================
// SUBJECTS
// ==================================================
export const createSubject = (payload) => api.post("/subjects", payload);
export const getSubjects = () => api.get("/subjects");
export const getStudentSubjects = (studentId) =>
  api.get(`/students/${studentId}/subjects`);
export const deleteSubject = (id) => api.delete(`/subjects/${id}`);

// ==================================================
// TOPICS
// ==================================================
export const createTopic = (payload) => api.post("/topics", payload);
export const getTopics = () => api.get("/topics");
export const getSubjectTopics = (subjectId) =>
  api.get(`/subjects/${subjectId}/topics`);
export const deleteTopic = (id) => api.delete(`/topics/${id}`);
export const getEnrichedTopics = (studentId) =>
  api.get(`/students/${studentId}/topics/enriched`);

// ==================================================
// PERFORMANCE
// ==================================================
export const createPerformance = (payload) => api.post("/performance", payload);
export const getStudentPerformance = (studentId) =>
  api.get(`/students/${studentId}/performance`);
export const updatePerformance = (id, score, attempts = 1) =>
  api.put(`/performance/${id}?score=${score}&attempts=${attempts}`);

// ==================================================
// STUDY PLAN
// ==================================================
export const createStudyPlan = (payload) => api.post("/study-plan", payload);
export const getStudentStudyPlan = (studentId) =>
  api.get(`/students/${studentId}/study-plan`);
export const completeStudyPlan = (id) =>
  api.put(`/study-plan/${id}/complete`);
export const getDailyStudyPlan = (studentId) =>
  api.get(`/students/${studentId}/study-plan/daily`);

// ==================================================
// LEGACY QUIZ
// ==================================================
export const createQuizQuestion = (payload) =>
  api.post("/quiz/questions", payload);
export const getTopicQuestions = (topicId) =>
  api.get(`/topics/${topicId}/questions`);
export const bulkCreateQuestions = (questions) =>
  api.post("/quiz/questions/bulk", { questions });
export const createQuizResult = (payload) => api.post("/quiz/results", payload);
export const getStudentQuizResults = (studentId) =>
  api.get(`/students/${studentId}/quiz-results`);

// ==================================================
// ANALYTICS
// ==================================================
export const getDashboardAnalytics = (studentId) =>
  api.get(`/analytics/dashboard/${studentId}`);
export const getAnalyticsTimeline = (studentId, days = 30) =>
  api.get(`/analytics/timeline/${studentId}?days=${days}`);

// ==================================================
// ML PREDICTION
// ==================================================
export const getMlPredictions = (studentId) =>
  api.get(`/ml/predict/${studentId}`);

// ==================================================
// AI TUTOR (legacy)
// ==================================================
export const askAiTutor = (payload) => api.post("/ai/ask", payload);
export const learnFromText = (payload) => api.post("/ai/learn-from-text", payload);

// ==================================================
// TOPIC SEARCH + CONTENT
// ==================================================
export const searchOrCreateTopic = (payload) =>
  api.post("/topics/search-or-create", payload);
export const generateTopicContent = (topicId, force = false) =>
  api.post(`/topics/${topicId}/generate-content?force=${force}`);
export const getTopicContent = (topicId) =>
  api.get(`/topics/${topicId}/content`);
export const extractTopicConcepts = (topicId, force = false) =>
  api.post(`/topics/${topicId}/extract-concepts?force=${force}`);
export const listTopicConcepts = (topicId) =>
  api.get(`/topics/${topicId}/concepts`);
export const getTopicFull = (topicId) => api.get(`/topics/${topicId}/full`);

// ==================================================
// CONCEPT DEEP-DIVE
// ==================================================
export const getConceptContent = (conceptId, force = false) =>
  api.post(`/concepts/${conceptId}/content?force=${force}`);

// ==================================================
// TESTS (ADAPTIVE & CACHED)
// ==================================================
export const generateTest = (topicId, studentId, numQuestions = 6, force = false) =>
  api.post("/tests/generate", {
    topic_id: topicId,
    num_questions: numQuestions,
    student_id: studentId,
    force: force,
  });

export const generateSmartTest = (studentId, numQuestions = 6) =>
  api.post("/tests/generate-smart", {
    student_id: studentId,
    num_questions: numQuestions,
  });

export const submitTest = (studentId, answers, sessionId = null) => 
  api.post("/tests/submit", { 
    student_id: studentId, 
    answers: answers, 
    session_id: sessionId 
  });

export const getStudentConcepts = (studentId) =>
  api.get(`/students/${studentId}/concepts`);

// ==================================================
// RECOMMENDATIONS
// ==================================================
export const generateRecommendations = (studentId, force = false) =>
  api.post(`/students/${studentId}/generate-recommendations?force=${force}`);
export const listRecommendations = (studentId) =>
  api.get(`/students/${studentId}/recommendations`);
export const completeRecommendation = (recId, studentId) =>
  api.put(`/recommendations/${recId}/complete?student_id=${studentId}`);

// ==================================================
// STRUGGLES + ROADMAPS
// ==================================================
export const getStudentStruggles = (studentId) =>
  api.get(`/students/${studentId}/struggles`);
  
export const analyzeTopic = (topicId, studentId) =>
  api.post(`/topics/${topicId}/analyze`, { student_id: studentId });

// ==================================================
// SEARCH HISTORY
// ==================================================
export const getSearchHistory = (studentId, limit = 30) =>
  api.get(`/students/${studentId}/search-history?limit=${limit}`);
export const deleteSearchHistoryEntry = (entryId, studentId) =>
  api.delete(`/search-history/${entryId}?student_id=${studentId}`);
export const clearSearchHistory = (studentId) =>
  api.delete(`/students/${studentId}/search-history`);

// ==================================================
// FILE EXTRACTION (legacy)
// ==================================================
export const extractFile = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/files/extract", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ==================================================
// NOTIFICATIONS
// ==================================================
export const getNotifications = (studentId) =>
  api.get(`/notifications/${studentId}`);

// ==================================================
// FLASHCARDS
// ==================================================
export const generateFlashcards = (payload) =>
  api.post("/flashcards/generate", payload);

// ==================================================
// ONBOARDING
// ==================================================
export const startOnboarding = (payload) =>
  api.post("/onboarding/start", payload);
export const generateDiagnostic = (studentId) =>
  api.post("/onboarding/diagnostic/generate", { student_id: studentId });
export const submitDiagnostic = (payload) =>
  api.post("/onboarding/diagnostic/submit", payload);
export const getOnboardingStatus = (studentId) =>
  api.get(`/onboarding/status/${studentId}`);

// ==================================================
// NOVAAI CHAT
// ==================================================
export const getChatModels = () => api.get("/chat/models");

export const listConversations = (studentId, q = "") =>
  api.get(`/chat/conversations?student_id=${studentId}&q=${encodeURIComponent(q)}`);

export const createConversation = (studentId, title = "New chat", model = "groq-oss-120b") =>
  api.post("/chat/conversations", { student_id: studentId, title, model });

export const getConversation = (convId, studentId) =>
  api.get(`/chat/conversations/${convId}?student_id=${studentId}`);

export const updateConversation = (convId, studentId, updates) =>
  api.patch(`/chat/conversations/${convId}?student_id=${studentId}`, updates);

export const deleteConversation = (convId, studentId) =>
  api.delete(`/chat/conversations/${convId}?student_id=${studentId}`);

export const sendMessageFeedback = (msgId, studentId, feedback) =>
  api.patch(`/chat/messages/${msgId}/feedback`, { student_id: studentId, feedback });

export const deleteMessage = (msgId, studentId) =>
  api.delete(`/chat/messages/${msgId}?student_id=${studentId}`);

export const uploadChatAttachment = (convId, studentId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(
    `/chat/conversations/${convId}/attachments?student_id=${studentId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
};

export const listChatAttachments = (convId, studentId) =>
  api.get(`/chat/conversations/${convId}/attachments?student_id=${studentId}`);

export const deleteChatAttachment = (attachmentId, studentId) =>
  api.delete(`/chat/attachments/${attachmentId}?student_id=${studentId}`);

export const getAttachmentDebug = (attachmentId) =>
  api.get(`/chat/attachments/${attachmentId}/debug`);

// ==================================================
// ALIASES (compat with older import names)
// ==================================================
export const getRecommendationsList = listRecommendations;
export const searchTopic = (topic_name, student_id, difficulty = "medium") =>
  searchOrCreateTopic({ topic_name, student_id, difficulty });
export const getAnalytics = getDashboardAnalytics;
export const getStudentStats = getProfileStats;
export const clearHistory = clearSearchHistory;
export const deleteHistoryEntry = deleteSearchHistoryEntry;
export const regenerateContent = (topicId) => generateTopicContent(topicId, true);
export const getTopic = getTopicFull;
export const getConcept = getConceptContent;
export const generateConcept = getConceptContent;
export const listConcepts = listTopicConcepts;
export const extractConcepts = extractTopicConcepts;
export const startTest = generateTest;
export const finishTest = submitTest;
export const getRecommendations = listRecommendations;
export const markRecommendationComplete = completeRecommendation;
export const getFlashcards = generateFlashcards;

// ==================================================
// NOVAAI CHAT — Streaming (SSE)
// ==================================================
export async function streamChatMessage(
  convId,
  studentId,
  content,
  model,
  handlers = {},
  signal = undefined,
  options = {}
) {
  const response = await fetch(
    `${API_URL}/chat/conversations/${convId}/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        content,
        model,
        web_search: options.web_search || false,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Stream failed (${response.status}): ${errText || response.statusText}`);
  }

  if (!response.body) throw new Error("Response has no body — streaming not supported.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") return;

        try {
          const data = JSON.parse(payload);
          const type = data.type;
          if (handlers[type]) {
            handlers[type](data);
          } else if (handlers.onEvent) {
            handlers.onEvent(data);
          }
        } catch (e) {
          // ignore malformed events
        }
      }
    }
  }
}

export default api;