export type JsonSchema = {
  readonly type?: string;
  readonly enum?: readonly string[];
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly items?: JsonSchema;
  readonly anyOf?: readonly JsonSchema[];
};

const stringSchema: JsonSchema = {
  type: "string"
};

const integerScoreSchema: JsonSchema = {
  type: "integer",
  minimum: 0,
  maximum: 100
};

export const questionJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "text",
    "category",
    "rationale"
  ],
  properties: {
    id: stringSchema,
    text: stringSchema,
    category: stringSchema,
    rationale: stringSchema
  }
};

export const startInterviewJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "question"
  ],
  properties: {
    question: questionJsonSchema
  }
};

export const suggestAnswerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "suggestedAnswer",
    "speakingTips"
  ],
  properties: {
    suggestedAnswer: stringSchema,
    speakingTips: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: stringSchema
    }
  }
};

export const answerFeedbackJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "correctedAnswer",
    "correctionSpans",
    "issues",
    "grammarFeedback",
    "contentFeedback",
    "pronunciationHints",
    "strengths",
    "improvements",
    "score",
    "decision",
    "decisionReason",
    "nextQuestion"
  ],
  properties: {
    correctedAnswer: stringSchema,
    correctionSpans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "text",
          "type"
        ],
        properties: {
          text: stringSchema,
          type: {
            type: "string",
            enum: [
              "grammar",
              "spelling",
              "word_choice",
              "clarity",
              "content_gap",
              "strong_point",
              "neutral"
            ]
          }
        }
      }
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "originalText",
          "suggestedText",
          "explanation",
          "severity"
        ],
        properties: {
          type: {
            type: "string",
            enum: [
              "grammar",
              "spelling",
              "word_choice",
              "clarity",
              "content_gap",
              "strong_point"
            ]
          },
          originalText: stringSchema,
          suggestedText: stringSchema,
          explanation: stringSchema,
          severity: {
            type: "string",
            enum: [
              "low",
              "medium",
              "high"
            ]
          }
        }
      }
    },
    grammarFeedback: {
      type: "array",
      items: stringSchema
    },
    contentFeedback: {
      type: "array",
      items: stringSchema
    },
    pronunciationHints: {
      type: "array",
      items: stringSchema
    },
    strengths: {
      type: "array",
      items: stringSchema
    },
    improvements: {
      type: "array",
      items: stringSchema
    },
    score: {
      type: "object",
      additionalProperties: false,
      required: [
        "communication",
        "roleRelevance",
        "structure",
        "languageAccuracy",
        "confidence"
      ],
      properties: {
        communication: integerScoreSchema,
        roleRelevance: integerScoreSchema,
        structure: integerScoreSchema,
        languageAccuracy: integerScoreSchema,
        confidence: integerScoreSchema
      }
    },
    decision: {
      type: "string",
      enum: [
        "follow_up",
        "new_topic",
        "end"
      ]
    },
    decisionReason: stringSchema,
    nextQuestion: {
      anyOf: [
        questionJsonSchema,
        {
          type: "null"
        }
      ]
    }
  }
};
