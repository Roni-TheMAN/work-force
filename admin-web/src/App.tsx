function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        margin: 0,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Admin Web
        </p>
        <h1 style={{ margin: "0.75rem 0 0.5rem" }}>Minimal Vite Starter</h1>
        <p style={{ margin: 0, color: "#475569" }}>Admin dashboard entry point.</p>
      </section>
    </main>
  );
}

export default App;
