# API Specification Template

## Endpoint / Service Function: `functionName`

### Signature
```typescript
export async function functionName(input: InputType): Promise<OutputType>;
```

### Parameters & Types
- `input`: `InputType` (validated via Zod)

### Return Value & Error Responses
- Returns `OutputType` on clean execution.
- Throws `Error` with descriptive message on authorization failure or constraint violation.
