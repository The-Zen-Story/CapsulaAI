import { ModelCapability } from './tester';

export class PromptEngine {
  static getExtractionPrompt(text: string, capability: ModelCapability): string {
    const baseSchema = `
    {
      "meta": {
        "title": "string",
        "created_at": "ISO string",
        "language": "en/zh"
      },
      "content": {
        "summary": "string",
        "key_points": ["string array"]
      },
      "entities": [
        {
          "name": "string",
          "type": "PERSON | ORGANIZATION | LOCATION | EVENT | PRODUCT | DATE | MONEY",
          "role": "optional string (for PERSON)",
          "contact": "optional string (email/phone)",
          "amount": "optional number (for MONEY)",
          "currency": "optional string (for MONEY)",
          "isoString": "optional string (for DATE)"
        }
      ],
      "actions": [
        {
          "type": "TODO | REMINDER | FOLLOW_UP",
          "description": "string",
          "deadline": "optional string (ISO date for TODO)",
          "priority": "HIGH | MEDIUM | LOW (for TODO)",
          "triggerTime": "optional string (ISO date for REMINDER)",
          "person": "optional string (for FOLLOW_UP)"
        }
      ],
      "relationships": [
        {
          "from": "entity name",
          "fromType": "PERSON | ORGANIZATION | LOCATION | EVENT | PRODUCT | DATE | MONEY",
          "to": "entity name",
          "toType": "PERSON | ORGANIZATION | LOCATION | EVENT | PRODUCT | DATE | MONEY",
          "type": "WORKS_FOR | FOUNDED | INVESTED_IN | LOCATED_IN | ACQUIRED | PARTNERED_WITH | REPORTS_TO | OWNS | ATTENDED | MENTIONED_WITH | OCCURRED_ON | COSTS | VALUED_AT | CREATED | RELEASED | OTHER",
          "confidence": "0.0-1.0",
          "metadata": {
            "title": "optional string (job title, role)",
            "startDate": "optional ISO date",
            "amount": "optional string (for investments/acquisitions)"
          }
        }
      ],
      "tags": ["string array"]
    }
    `;

    if (capability === ModelCapability.ADVANCED) {
      // CoT Prompt for smart models
      return `
      You are an expert knowledge curator. Analyze the following text and extract structured insights.
      
      Step 1: Identify the main topic and key entities (People, Organizations, Locations, Events, Products, Dates, Money).
      Step 2: Identify relationships between entities. CRITICAL: Every extracted Entity (especially Dates and Money) MUST be connected to at least one other entity via a Relationship. Do not leave isolated entities.
      Step 3: Identify any actionable items (Todos, Reminders, Follow-ups).
      Step 4: Summarize the core message in 1-2 sentences.
      Step 5: Extract key points and suggest relevant tags.
      Step 6: Output the result strictly in the following JSON format:
      ${baseSchema}

      Entity Extraction Rules:
      - PERSON: Extract role and contact info if available.
      - MONEY: Extract numerical amount and currency.
      - DATE: Normalize to ISO format if possible.

      Action Extraction Rules:
      - TODO: Extract tasks with clear deadlines or priorities.
      - REMINDER: Extract specific time-based alerts.
      - FOLLOW_UP: Extract interpersonal follow-ups.

      Relationship Extraction Rules:
      - WORKS_FOR: Person → Organization (extract job title if available)
      - FOUNDED: Person → Organization (extract founding date if available)
      - INVESTED_IN: Organization → Organization (extract amount and round if available)
      - LOCATED_IN: Person/Organization/Event → Location
      - ACQUIRED: Organization → Organization (extract amount and date if available)
      - CREATED / RELEASED: Organization/Person → Product/Event
      - OCCURRED_ON: Event/Action → DATE
      - COSTS / VALUED_AT: Product/Organization/Event → MONEY
      - MENTIONED_WITH: Any → Any (co-occurrence in same context)
      - Confidence: 1.0 for explicit statements, 0.5-0.9 for implied relationships

      Text to analyze:
      ${text}
      `;
    } else {
      // Structured prompt for basic models — still requires relationships
      return `You are a knowledge extraction assistant. Extract structured data from the following text and output ONLY valid JSON matching this schema:
${baseSchema}

RULES:
1. Extract entities: people, organizations, locations, events, products, dates, money amounts.
2. For EVERY entity you extract, you MUST create at least one relationship connecting it to another entity.
   - DATE entities: use OCCURRED_ON to link to an event or action.
   - MONEY entities: use COSTS or VALUED_AT to link to a product or organization.
   - PERSON entities: use WORKS_FOR, FOUNDED, or MENTIONED_WITH.
   - Do NOT output isolated entities with no relationships.
3. Fill in the 'relationships' array completely.
4. Output ONLY the JSON object, no explanations.

Text:
"${text}"

JSON OUTPUT:`;
    }
  }
  static getComplexityAnalysisPrompt(text: string): string {
    return `
Analyze the following text to determine if it requires complex reasoning to understand or if it is simple factual information.
Return valid JSON only: { "complexity": "SIMPLE" } or { "complexity": "COMPLEX" }.

Criteria for COMPLEX:
- Text is long (> 500 words)
- Requires summarization of abstract concepts
- Contains ambiguous logic

Criteria for SIMPLE:
- Short messages or notes
- Clear lists of items
- Contact information only

Text:
"${text.substring(0, 1000)}" 
`;
  }
}
