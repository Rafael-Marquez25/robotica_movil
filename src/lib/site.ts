export const site = {
  title: 'Robótica Móvil',
  description: 'Cuaderno de prácticas de la asignatura de Robótica Móvil.',
  repository: 'https://github.com/Rafael-Marquez25/robotica_movil',
};

export function localUrl(path = ''): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}
