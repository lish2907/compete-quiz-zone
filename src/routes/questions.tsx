import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/questions")({
  component: QuestionsPage,
});

function QuestionsPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Question Bank</h1>

      <button
        style={{
          padding: "10px 20px",
          marginTop: "20px",
          cursor: "pointer",
        }}
      >
        Add Question
      </button>

      <div style={{ marginTop: "30px" }}>
        <p>No questions yet.</p>
      </div>
    </div>
  );
}
