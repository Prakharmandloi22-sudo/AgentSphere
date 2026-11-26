import crypto from 'crypto';

/**
 * AgentSphere Platform Security Service
 * Implements AES-256-GCM encryption, API key generation/hashing,
 * prompt injection defense heuristics, and output guardrails.
 */
export class SecurityService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  // Derives 32-byte key from environment or fallback
  private static getEncryptionKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    if (rawKey.length === 64) {
      return Buffer.from(rawKey, 'hex');
    }
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM
   */
  public static encrypt(plainText: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = this.getEncryptionKey();
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedPayload
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts ciphertext string using AES-256-GCM
   */
  public static decrypt(cipherText: string): string {
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted string format. Expected iv:authTag:payload');
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const key = this.getEncryptionKey();

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generates a secure scoped API key
   * Returns: { apiKey, keyPrefix, keyHash }
   */
  public static generateApiKey(): { apiKey: string; keyPrefix: string; keyHash: string } {
    const randomHex = crypto.randomBytes(24).toString('hex');
    const apiKey = `asp_live_${randomHex}`;
    const keyPrefix = apiKey.substring(0, 14); // "asp_live_xxxx"
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    return { apiKey, keyPrefix, keyHash };
  }

  /**
   * Hashes an incoming API key to compare against database record
   */
  public static hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Prompt Injection Defense Heuristic
   * Detects common jailbreaks, prompt leaks, and role overrides.
   */
  public static detectPromptInjection(prompt: string): { isInjected: boolean; reason?: string } {
    const lower = prompt.toLowerCase();

    const injectionPatterns = [
      { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, reason: 'Attempt to override prior system instructions' },
      { pattern: /disregard\s+(the\s+)?(system|initial)\s+prompt/i, reason: 'Attempt to disregard system prompt' },
      { pattern: /you\s+are\s+now\s+(an?\s+)?unrestricted|dan\b|jailbreak/i, reason: 'Jailbreak roleplay attempt (DAN / unrestricted)' },
      { pattern: /reveal\s+(your\s+)?(system\s+prompt|secret\s+key|api\s+key)/i, reason: 'System secret or prompt leakage attempt' },
      { pattern: /print\s+(your\s+)?initial\s+instructions/i, reason: 'Prompt extraction attempt' },
      { pattern: /bypass\s+(all\s+)?safety\s+filters/i, reason: 'Filter bypass directive' },
      { pattern: /base64\s+decode\s+and\s+execute/i, reason: 'Obfuscated command execution attempt' }
    ];

    for (const item of injectionPatterns) {
      if (item.pattern.test(lower)) {
        return { isInjected: true, reason: item.reason };
      }
    }

    return { isInjected: false };
  }

  /**
   * Output Guardrails: Masks PII (SSN, emails, credit cards) and internal secrets
   */
  public static applyOutputGuardrails(text: string): { sanitizedText: string; redactionCount: number } {
    let sanitized = text;
    let count = 0;

    // Mask SSN: \b\d{3}-\d{2}-\d{4}\b
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    sanitized = sanitized.replace(ssnRegex, () => {
      count++;
      return '[REDACTED_SSN]';
    });

    // Mask Credit Card (13 to 16 digits with hyphens or spaces)
    const ccRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
    sanitized = sanitized.replace(ccRegex, () => {
      count++;
      return '[REDACTED_CREDIT_CARD]';
    });

    // Mask API Keys and Bearer tokens: asp_live_..., sk-..., Bearer ...
    const secretRegex = /\b(asp_live_[a-f0-9]{48}|sk-[a-zA-Z0-9]{32,}|Bearer\s+[a-zA-Z0-9\-._~+/]+=*)\b/gi;
    sanitized = sanitized.replace(secretRegex, () => {
      count++;
      return '[REDACTED_SECRET]';
    });

    return { sanitizedText: sanitized, redactionCount: count };
  }
}
