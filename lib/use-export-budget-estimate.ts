"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  estimateExportBudgetFromContributions,
  estimateExportSize,
  MAX_HTML_EXPORT_BYTES,
} from "./export/html-generator";
import { embedImages } from "./export/image-conversion";
import type { ExportBudgetEstimate } from "./export/types";
import { normalizeLegacyMusic } from "./music";
import { collectLocalMediaRefs } from "./local-media";
import type { SurpriseData } from "./types";

const signatureFor = (data: SurpriseData) => {
  return collectLocalMediaRefs(normalizeLegacyMusic(data))
    .map(({ kind, media }) => `${kind}:${media.id}:${media.name}:${media.size}:${media.mimeType}:${"width" in media ? media.width || 0 : 0}:${"height" in media ? media.height || 0 : 0}:${media.previewUrl}`)
    .join("|");
};

const calculatingEstimate = (data: SurpriseData): ExportBudgetEstimate => {
  const rough = estimateExportSize(data);
  return {
    ...rough,
    limitBytes: MAX_HTML_EXPORT_BYTES,
    originalBytes: rough.sourceBytes,
    predictedBytes: rough.estimatedBytes,
    conservativeBytes: rough.estimatedBytes + Math.max(256 * 1024, Math.ceil(rough.estimatedBytes * 0.05)),
    confidence: "approximate",
    state: rough.contributors.length ? "calculating" : "safe",
  };
};

export function useExportBudgetEstimate(data: SurpriseData): ExportBudgetEstimate {
  const source = useMemo(() => normalizeLegacyMusic(data), [data]);
  const signature = useMemo(() => signatureFor(source), [source]);
  const sourceRef = useRef(source);
  const [estimate, setEstimate] = useState(() => calculatingEstimate(source));

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    const currentSource = sourceRef.current;
    const rough = calculatingEstimate(currentSource);
    setEstimate(rough);
    if (!rough.contributors.length) return;
    const timer = window.setTimeout(() => {
      const contributions = [] as Parameters<typeof estimateExportBudgetFromContributions>[1];
      void embedImages(currentSource, undefined, (contribution) => {
        contributions.push(contribution);
      })
        .then(() => {
          if (cancelled) return;
          setEstimate(
            estimateExportBudgetFromContributions(
              currentSource,
              contributions,
              currentSource.appearance.backgroundImage?.source === "url" ||
                contributions.some((item) => item.originalBytes === 0)
                ? "approximate"
                : "exact-local",
            ),
          );
        })
        .catch(() => {
          if (!cancelled)
            setEstimate({
              ...rough,
              confidence: "unknown",
              state: "unknown",
              unknownCount: rough.contributors.length,
            });
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signature]);

  return estimate;
}
