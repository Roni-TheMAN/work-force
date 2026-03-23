function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        margin: 0,
        background: "#f5f7fb",
        color: "#1f2937",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Client Web
        </p>
        <h1 style={{ margin: "0.75rem 0 0.5rem" }}>Minimal Vite Starter</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>Public web app entry point.</p>
      </section>
    </main>
  );
}

export default App;
