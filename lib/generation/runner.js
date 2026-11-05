import { isAiLimitError, alertAiLimit, AI_PAUSED_MESSAGE } from "@/lib/generation/aiLimit";
// Runs background generation jobs one stage at a time.
// Each stage runs in its own short server request (well inside Vercel's time limit). When a stage
// finishes, it asks the server to run the next one. If a hand-over is ever missed, the dashboard's
// progress check restarts the job from where it stopped.
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPreview, FREE_PREVIEW_LIMIT } from "@/lib/documents/preview";
import { joinNotes } from "@/lib/documents/clarity";
import { logDocumentEvent } from "@/lib/documents/events";
import { runClaude, extractTag, WebSearchUnavailableError } from "@/lib/generation/claude";
import { stagesFor, basePrompts, stagePrompt, DOC_TYPE } from "@/lib/generation/stages";

// How long one stage may run. Must stay below the run route's maxDuration (300 seconds).
const STAGE_SECONDS = Math.min(Number(process.env.STAGE_TIME_LIMIT) || 255, 280);
// How long a claimed stage is protected from being started twice.
const LEASE_SECONDS = STAGE_SECONDS + 45;
// A stage that keeps failing or keeps getting cut off stops the job.
const MAX_ATTEMPTS_PER_STAGE = 6;

export const ACTIVE_STATUSES = ["queued", "running"];

// Asks the server to run the next stage of a job. Returns quickly: the run route answers at once
// and does the work after replying.
export async function kickJob(origin, jobId) {
  try {
    const res = await fetch(`${origin}/api/jobs/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId }),
      cache: "no-store",
    });
    if (!res.ok) console.error("Job hand-over refused:", res.status, jobId);
  } catch (err) {
    console.error("Job hand-over failed:", jobId, err?.message);
  }
}

// Takes the job for this request, so two requests never run the same stage at once.
async function claimJob(admin, jobId) {
  const now = new Date();
  const { data, error } = await admin
    .from("generation_jobs")
    .update({
      status: "running",
      locked_until: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", jobId)
    .in("status", ACTIVE_STATUSES)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("*");
  if (error) {
    console.error("Job claim error:", error);
    return null;
  }
  return data?.[0] ?? null;
}

async function failJob(admin, job, message, detail) {
  console.error("Generation job failed:", JSON.stringify({ job_id: job.id, stage: job.stage_index, detail }));
  await admin
    .from("generation_jobs")
    .update({
      status: "failed",
      error: message,
      locked_until: null,
      document_text: "",
      research_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

/**
 * Runs the next stage of one job. Safe to call more than once: only one call can claim the job.
 * Returns "done", "failed", "next" (another stage is due) or "busy" (someone else has it).
 */
export async function runNextStage(jobId, origin, { deadlineMs } = {}) {
  const admin = createAdminClient();
  const job = await claimJob(admin, jobId);
  if (!job) return "busy";

  const stages = stagesFor(job.action_type);
  const stage = stages[job.stage_index];
  if (!stage) {
    await finalizeJob(admin, job);
    return "done";
  }

  if ((job.attempts ?? 0) >= MAX_ATTEMPTS_PER_STAGE) {
    await failJob(
      admin,
      job,
      "We could not finish this document. You have not been charged. Please try again, or shorten the material you pasted in.",
      { reason: "too_many_attempts", stage: stage.key }
    );
    return "failed";
  }

  const startedAt = Date.now();
  const hasBackground = String(job.input?.project_background || "").trim().length > 0;
  const base = basePrompts(job.action_type, job.input || {});
  const userPrompt = `${base.user}\n${stagePrompt({
    stage,
    stageNumber: job.stage_index + 1,
    stageCount: stages.length,
    job,
    hasBackground,
  })}`;

  let ai;
  try {
    ai = await runClaude({
      systemPrompt: base.system,
      userPrompt,
      maxTokens: stage.maxTokens,
      searchLimit: stage.searchLimit || 0,
      deadlineMs: Math.min(startedAt + STAGE_SECONDS * 1000, deadlineMs || Infinity),
      effort: stage.kind === "research"
        ? process.env.RESEARCH_EFFORT || "medium"
        : process.env.GENERATION_EFFORT || "medium",
    });
  } catch (err) {
    if (err instanceof WebSearchUnavailableError) {
      await failJob(
        admin,
        job,
        "Source verification is temporarily unavailable, so nothing was generated and you have not been charged. Please try again shortly.",
        { reason: "web_search_unavailable", message: err.message }
      );
      return "failed";
    }
    if (isAiLimitError(err)) {
      await alertAiLimit(admin, err);
      await failJob(admin, job, AI_PAUSED_MESSAGE, { reason: "ai_usage_limit", message: err?.error?.error?.message || err?.message });
      return "failed";
    }
    console.error(
      "Stage request error:",
      JSON.stringify({
        job_id: job.id,
        stage: stage.key,
        status: err?.status,
        message: err?.error?.error?.message || err?.message,
      })
    );
    await admin
      .from("generation_jobs")
      .update({ attempts: (job.attempts ?? 0) + 1, locked_until: null, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return "next";
  }

  const tag = stage.kind === "research" ? "research_notes" : "section_text";
  const written = extractTag(ai.text, tag);
  const cutOff = ai.timedOut || ai.stopReason === "max_tokens";

  console.log(
    "Stage finished:",
    JSON.stringify({
      job_id: job.id,
      stage: stage.key,
      seconds: Math.round((Date.now() - startedAt) / 1000),
      stop_reason: ai.stopReason,
      chars: written?.length ?? 0,
      output_tokens: ai.usage?.output_tokens,
    })
  );

  if (ai.stopReason === "refusal") {
    await failJob(
      admin,
      job,
      "The request could not be completed. Please rephrase your research topic and try again. You have not been charged.",
      { reason: "refusal", stage: stage.key }
    );
    return "failed";
  }

  if (!written) {
    // Nothing usable came back (for example, the time ran out during planning). Try the stage again.
    await admin
      .from("generation_jobs")
      .update({
        attempts: (job.attempts ?? 0) + 1,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return "next";
  }

  const update = { locked_until: null, updated_at: new Date().toISOString() };
  if (stage.kind === "research") {
    update.research_notes = job.continuation && job.research_notes ? `${job.research_notes}\n${written}` : written;
  } else {
    const glue = job.continuation ? " " : "\n\n";
    update.document_text = job.document_text ? `${job.document_text}${glue}${written}` : written;
    const note = extractTag(ai.text, "clarity_note");
    if (note) update.clarity_note = note;
    const check = extractTag(ai.text, "verification_note");
    if (check) update.verification_note = check;
  }

  if (cutOff) {
    // Keep what was written and carry on with the same stage in the next request.
    update.continuation = true;
    update.attempts = (job.attempts ?? 0) + 1;
  } else {
    update.continuation = false;
    update.attempts = 0;
    update.stage_index = job.stage_index + 1;
    const nextStage = stages[job.stage_index + 1];
    update.stage_label = nextStage ? nextStage.label : "Finishing your document";
  }

  const { error: saveErr } = await admin.from("generation_jobs").update(update).eq("id", job.id);
  if (saveErr) {
    console.error("Stage save error:", saveErr);
    return "next";
  }

  if (!cutOff && job.stage_index + 1 >= stages.length) {
    const { data: finished } = await admin.from("generation_jobs").select("*").eq("id", job.id).single();
    await finalizeJob(admin, finished);
    return "done";
  }
  return "next";
}

// Saves the finished document, spends the credit (or records the free preview) and stores the
// result the dashboard shows.
async function finalizeJob(admin, job) {
  const mainDocument = String(job.document_text || "").trim();
  if (!mainDocument) {
    await failJob(admin, job, "The model returned no content. You have not been charged. Please try again.", {
      reason: "empty_document",
    });
    return;
  }

  const docType = DOC_TYPE[job.action_type];
  const input = job.input || {};
  const clarityNote = docType !== "field_data" ? String(job.clarity_note || "").trim() : "";
  const verificationNote = String(job.verification_note || "").trim();
  const fullText = joinNotes(mainDocument, { clarity: clarityNote, verification: verificationNote });
  const baseRow = {
    user_id: job.user_id,
    document_type: docType,
    research_topic: input.research_topic || "Extracted from Document Input",
    target_institution: input.target_institution || "Extracted Guidelines",
    ...(input.project_id ? { project_id: input.project_id } : {}),
  };

  let result;

  if (job.preview_mode) {
    const { previewText, previewWords, totalWords, lockedSections } = buildPreview(mainDocument);
    const { data: saved, error: saveErr } = await admin
      .from("documents")
      .insert({ ...baseRow, generated_content: previewText, is_unlocked: false })
      .select("id")
      .single();
    if (saveErr || !saved) {
      await failJob(admin, job, "Your preview was generated but could not be saved. Please try again.", saveErr);
      return;
    }
    const { error: secretErr } = await admin
      .from("document_secrets")
      .insert({ document_id: String(saved.id), content: fullText });
    if (secretErr) {
      await admin.from("documents").delete().eq("id", saved.id);
      await failJob(admin, job, "Your preview could not be saved. Please try again.", secretErr);
      return;
    }

    const { data: sub } = await admin
      .from("subscriptions")
      .select("free_previews_used")
      .eq("user_id", job.user_id)
      .maybeSingle();
    const previewsUsed = (sub?.free_previews_used ?? 0) + 1;
    const { error: usedErr } = await admin
      .from("subscriptions")
      .update({ free_previews_used: previewsUsed })
      .eq("user_id", job.user_id);
    if (usedErr) console.error("Preview counter error:", usedErr);

    result = {
      success: true,
      locked: true,
      document_id: saved.id,
      preview: previewText,
      preview_words: previewWords,
      total_words: totalWords,
      locked_sections: lockedSections,
      free_previews_remaining: Math.max(0, FREE_PREVIEW_LIMIT - previewsUsed),
    };
  } else {
    const { data: saved, error: saveErr } = await admin
      .from("documents")
      .insert({ ...baseRow, generated_content: fullText, is_unlocked: true })
      .select("id")
      .single();
    if (saveErr || !saved) {
      await failJob(admin, job, "Your document was generated but could not be saved. You have not been charged.", saveErr);
      return;
    }

    // Spend the credit now that the document exists.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("tier, proposals_remaining, dissertations_remaining, data_simulations_remaining")
      .eq("user_id", job.user_id)
      .maybeSingle();
    const isEnterprise = sub?.tier === "consultant_enterprise";
    const hasDataTier = sub?.tier === "data_suite" || isEnterprise;
    let creditUpdate = null;
    if (job.action_type === "generate_proposal" && !isEnterprise && sub?.proposals_remaining > 0) {
      creditUpdate = { proposals_remaining: sub.proposals_remaining - 1 };
    } else if (job.action_type === "compile_dissertation" && !isEnterprise && sub?.dissertations_remaining > 0) {
      creditUpdate = { dissertations_remaining: sub.dissertations_remaining - 1 };
    } else if (job.action_type === "simulate_data" && !hasDataTier && sub?.data_simulations_remaining > 0) {
      creditUpdate = { data_simulations_remaining: sub.data_simulations_remaining - 1 };
    }
    if (creditUpdate) {
      const { error: creditErr } = await admin.from("subscriptions").update(creditUpdate).eq("user_id", job.user_id);
      if (creditErr) console.error("Credit decrement error:", creditErr);
    }

    await logDocumentEvent(admin, saved.id, job.user_id, "generated");
    result = { success: true, locked: false, document_id: saved.id };
  }

  // The working copy is no longer needed once the document is saved.
  await admin
    .from("generation_jobs")
    .update({
      status: "done",
      result,
      document_id: String(result.document_id),
      document_text: "",
      research_notes: null,
      clarity_note: null,
      verification_note: null,
      locked_until: null,
      stage_label: "Done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}
