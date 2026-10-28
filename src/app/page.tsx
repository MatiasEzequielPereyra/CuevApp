import { BrandMark } from "@/components/brand/brand-mark";
import { ThemePicker } from "@/components/theme/theme-picker";

const nextSteps = [
  { number: "01", title: "Cuotas claras", text: "Pagos, saldos y comprobantes en un mismo lugar." },
  { number: "02", title: "Tu rutina, a mano", text: "Una forma simple de consultar lo que toca entrenar." },
  { number: "03", title: "Técnica que acompaña", text: "Videos de ejercicios para consultar cada movimiento." },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header shell">
        <a className="brand-link" href="#inicio" aria-label="CUEVA, inicio"><BrandMark /></a>
        <span className="header-caption">EL ESPACIO DE TU ENTRENAMIENTO</span>
        <ThemePicker />
      </header>

      <main id="contenido" tabIndex={-1}>
        <section className="hero shell" id="inicio" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" aria-hidden="true" /> EN CONSTRUCCIÓN</p>
            <h1 id="hero-title">Un lugar<br />para <span>avanzar.</span></h1>
            <p className="hero-description">El esfuerzo es tuyo.<br />El próximo paso lo construimos juntos.</p>
            <a className="primary-link" href="#proyecto">Conocé el proyecto <span aria-hidden="true">↗</span></a>
            <p className="hero-note">Estamos preparando el espacio digital del gimnasio.</p>
          </div>
          <figure className="brand-stage">
            <div className="stage-topline"><span>FUERZA / CONSTANCIA</span><span aria-hidden="true">+</span></div>
            <div className="brand-orbit"><BrandMark size={480} decorative /></div>
            <figcaption>La misma identidad. Un nuevo espacio.</figcaption>
          </figure>
        </section>

        <section className="project shell" id="proyecto" aria-labelledby="project-title">
          <div className="section-heading">
            <p className="eyebrow">EL PROYECTO</p>
            <h2 id="project-title">Más simple.<br />Más cerca de entrenar.</h2>
          </div>
          <div className="project-description">
            <p>Queremos que lo cotidiano del gimnasio sea más fácil: organizar las cuotas, encontrar tu rutina y consultar cómo hacer un ejercicio.</p>
            <p className="muted">Esta primera versión presenta la identidad y la apariencia de la aplicación. El acceso a cuentas y las funciones del gimnasio todavía no están disponibles.</p>
          </div>
        </section>

        <section className="upcoming shell" aria-labelledby="upcoming-title">
          <div className="upcoming-heading"><h2 id="upcoming-title">Lo que viene</h2><span className="status-label">EN DESARROLLO</span></div>
          <div className="upcoming-grid">
            {nextSteps.map(({ number, title, text }) => (
              <article className="upcoming-card" key={number}>
                <span className="card-number" aria-hidden="true">{number}</span>
                <h3>{title}</h3><p>{text}</p>
              </article>
            ))}
          </div>
          <p className="availability-note">Estas funciones se incorporarán en próximas etapas. No hay datos de alumnos ni operaciones habilitadas en esta versión.</p>
        </section>
      </main>

      <footer className="site-footer shell"><BrandMark size={52} /><p>Hecha para el gimnasio.<br /><span className="muted">Paso a paso, con la misma fuerza.</span></p><span className="footer-status">VERSIÓN EN DESARROLLO</span></footer>
      <noscript><p className="noscript-note">La apariencia sigue el tema de tu dispositivo. Para elegir otro tema, activá JavaScript.</p></noscript>
    </>
  );
}
