Deno.serve(async (req) => {
  try {
    // Escalation reminder emails have been disabled.
    return new Response(JSON.stringify({ sent: 0, message: "Email reminders disabled" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
