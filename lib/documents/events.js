// A simple record of what happened to each document: generated, unlocked, downloaded, copied, printed.
// It helps check refund requests. Logging never stops the main action if it fails.

export const CLIENT_EVENTS = ["download", "print", "copy"];

export async function logDocumentEvent(admin, documentId, userId, event) {
  try {
    if (!documentId || !userId) return;
    const { error } = await admin
      .from("document_events")
      .insert({ document_id: String(documentId), user_id: userId, event });
    if (error) console.error("Document event log error:", error.message);
  } catch (err) {
    console.error("Document event log error:", err);
  }
}
