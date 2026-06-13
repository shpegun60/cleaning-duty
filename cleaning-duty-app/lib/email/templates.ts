export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function cleaningReminderTemplate(params: {
  name: string;
  dutyUrl: string;
}) {
  return {
    subject: "Нагадування про прибирання",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Сьогодні нагадування про твоє чергування.</p>
      <p><a href="${escapeHtml(params.dutyUrl)}">Відкрити список робіт</a></p>
    `,
  };
}

export function handoverReminderTemplate(params: {
  name: string;
  previousName: string;
  handoverUrl: string;
}) {
  return {
    subject: "Потрібно прийняти чергування",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Сьогодні потрібно прийняти чергування від ${escapeHtml(params.previousName)}.</p>
      <p><a href="${escapeHtml(params.handoverUrl)}">Відкрити приймання</a></p>
    `,
  };
}

export function handoverRejectedTemplate(params: {
  name: string;
  comment: string;
  dutyUrl: string;
}) {
  return {
    subject: "Чергування не прийняте",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Твоє чергування не було прийняте.</p>
      <p><strong>Коментар:</strong> ${escapeHtml(params.comment)}</p>
      <p><a href="${escapeHtml(params.dutyUrl)}">Відкрити список робіт</a></p>
    `,
  };
}

export function recheckRequestedTemplate(params: {
  name: string;
  previousName: string;
  handoverUrl: string;
}) {
  return {
    subject: "Повторна перевірка чергування",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>${escapeHtml(params.previousName)} позначив проблеми як виправлені.</p>
      <p><a href="${escapeHtml(params.handoverUrl)}">Відкрити повторну перевірку</a></p>
    `,
  };
}

export function adminChangedAssigneeTemplate(params: {
  name: string;
  dutyUrl: string;
}) {
  return {
    subject: "Тебе призначено черговим",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Адміністратор призначив це чергування тобі.</p>
      <p><a href="${escapeHtml(params.dutyUrl)}">Відкрити чергування</a></p>
    `,
  };
}

export function userInvitedTemplate(params: {
  name: string;
  loginUrl: string;
  email: string;
  password: string;
}) {
  return {
    subject: "Тебе додано до Cleaning Duty",
    html: `
      <p>Привіт, ${escapeHtml(params.name)}.</p>
      <p>Тебе додано до системи чергувань Cleaning Duty.</p>
      <p><strong>Логін:</strong> ${escapeHtml(params.email)}</p>
      <p><strong>Пароль:</strong> ${escapeHtml(params.password)}</p>
      <p><a href="${escapeHtml(params.loginUrl)}">Відкрити сторінку входу</a></p>
    `,
  };
}
