import { useNavigate, Link } from "react-router-dom";
import Header from "../components/Header";
function Community() {
  const navigate = useNavigate();
  const goTo = (path) => {
    navigate(path);
  };

  const testimonials = [
    {
      name: "Sarah J.",
      role: "Étudiante en Biologie",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAa9DGg1Vcnz__kLTRf_Mcv_eNYXIoBgs9eY2UFjn3Cf0ecOyyxJxeX4t031V-sy0oHd2fYz9lY81Mlr7GCvWEK4bMmPUfE-9zLmdGKkufVX4EnuqqQ7sIk1DER2r9j5HIXQJIHok4aHvr_srt7IjjRdjhXhCTS_NX7T2N3namFTYYav6hVclsNjRXQbLd5yoRxk0aFSIWkKzPGbsMFUfAdKnkbrZQ2fem3CJbWXmCcFoB0AudvPSlnnQ",
      text:
        "« L'ambiance conviviale et le travail de groupe rendent les révisions bien plus agréables. Préparer nos examens en créant des quiz à plusieurs a été la clé pour décrocher ma mention ! »",
    },
    {
      name: "Marc D.",
      role: "Enseignant en Collège",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAtJlIxFKHl4igxLmCOU7zPfMBVkifvWc7VBWhXeKWVn0B6dmkfgIHyDTX2__hdPDWZ1SY7_ti464loEp6CFlhJ-DGQYGP3rsvJSomlwAaZdA0D9rbnn9UGFzP-cj3w0PuOqnFe0VPNZ2kdiIDhYTltCm7FLH88vblZ2NAk_-6bQCV4xMzrv6O9hBZiet0PtGl_yCSqLGTUEKfrceunuCRj55oipcSzwVycWy_RHAuPKiHqsbWy5Qb1MQ",
      text:
        "« J'utilise les défis de groupe avec mes élèves de collège. La dynamique collective transforme la préparation des évaluations en une activité captivante et très stimulante. »",
    },
    {
      name: "Alex T.",
      role: "Passionné de Quiz",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA6tnquZ-06IxYQtVj5pJbaWK_mbot3JUinkUqd3rJBpsB4EO0U2hb9Pu9J_Lv2eHi50Vtyuu-Iw7YzhVlTNdlcou11ofrzwGWjpAFhmL_wQesZOytCvxICfoBaUYGD0SqSuFd2cie5aPoo4Zl2XSNSmks_bV4Y7dzRnJHFF2oNZE6TD6BDVw9rUpYV-xvjmePSn7NQDgA2fFvBfRtt4nyrqRpAztedQshHEUzsAlu2E6Hba6kSQjylQQ",
      text:
        "« Trouver des pairs passionnés par la culture générale et l'histoire a été une révélation. L'entraide et les quiz live du week-end sont devenus mon rituel préféré. »",
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col text-[#111C2C]"
      style={{
        background: "#F9F9FF",
        fontFamily: "Inter, sans-serif",
      }}
    >
   {/* HEADER COMMUN DE L'APPLICATION */}
        <Header current="community" />

      {/* CONTENU */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-4 md:px-16 py-12 md:py-24 space-y-16">
        {/* HERO */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center pt-4 pb-8">
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FFDBC9]/50 text-[#9B4500] border border-[#FC8A40]/20 rounded-full text-xs font-semibold uppercase tracking-wider">
              <span className="material-symbols-outlined text-base">groups</span>
              Communauté apprenante
            </div>

            <h1
              className="text-[#031632] text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Assemblez le savoir,
              <br className="hidden sm:inline" />
              <span className="text-[#FC8A40]"> ensemble</span> et en équipe.
            </h1>

            <p className="text-[#44474D] text-base md:text-lg leading-7 max-w-xl">
              Rejoignez des milliers d'apprenants et formateurs dans un espace
              interactif et stimulant. Créez des quiz coopératifs, rejoignez des
              ateliers et progressez ensemble chaque jour.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => goTo("/signup")}
                className="bg-[#FC8A40] hover:brightness-95 text-white font-semibold px-7 py-3.5 rounded-full shadow-md transition-all flex items-center gap-2 group"
              >
                Rejoindre la communauté
                <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </button>

              <button
                onClick={() => document.getElementById("groupes")?.scrollIntoView({ behavior: "smooth" })}
                className="bg-white hover:bg-[#F0F3FF] text-[#031632] border border-[#C5C6CE]/60 font-semibold px-7 py-3.5 rounded-full shadow-sm transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg text-[#FC8A40]">
                  explore
                </span>
                Explorer les groupes
              </button>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-[#44474D]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC8A40] text-base">
                  verified
                </span>
                +15 000 quiz partagés
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC8A40] text-base">
                  military_tech
                </span>
                Badges & certifications
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[460px] rounded-[24px] p-3 bg-gradient-to-b from-white to-[#F0F3FF] border border-[#C5C6CE]/40 shadow-xl overflow-hidden group">
              <video
                alt="Illustration de la communauté EduQuiz"
                className="w-full h-auto object-cover rounded-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                src="/banne.mp4"
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="groupes" className="space-y-12 pt-6">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#D8E3FA]/60 text-[#031632] rounded-full text-xs font-semibold">
              <span className="material-symbols-outlined text-sm text-[#FC8A40]">
                hub
              </span>
              Outils collaboratifs
            </div>

            <h2
              className="text-2xl md:text-3xl font-bold text-[#031632] tracking-tight"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Comment nous apprenons ensemble
            </h2>

            <p className="text-[#44474D] leading-relaxed text-sm md:text-base">
              Des fonctionnalités pensées pour rendre l'apprentissage actif,
              engageant et motivant en collectif.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CO-CREATION */}
            <div className="bg-white border border-[#C5C6CE]/40 rounded-2xl p-7 md:col-span-2 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <div className="space-y-3">
                <div className="w-11 h-11 bg-[#031632]/5 rounded-xl flex items-center justify-center text-[#031632] mb-4">
                  <span className="material-symbols-outlined text-2xl">
                    handshake
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#031632]" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Co-création de Quiz
                </h3>

                <p className="text-sm text-[#44474D] max-w-lg leading-relaxed">
                  Élaborez des questionnaires à plusieurs en temps réel.
                  Partagez des blocs de questions, relisez les propositions de
                  vos pairs et publiez vos défis pour toute la communauté.
                </p>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-[#F0F3FF]/70 border border-[#C5C6CE]/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {[
                      "https://lh3.googleusercontent.com/aida-public/AB6AXuCMIACnhyUSe2vT7BCGfhj2Oxr4CqrN31XqO0mHatwCpPqVfdg_Gy7ZbpyNX7SLoBF4mDFRV6D6TD5xlnvf2-75L8zEFmHqA_a2j5zHMlqsD-EuIHvF_G7DHUUiOHsKebOqE9fM0VSKIw0n8nBKqVwO7bXQEIset0Q6DJgTPB5sMfl7pEmh9tUvdvUFT9udjyF4IJGOD-HA-ZV3Rgn2TbxEwt1IDulLgMqCKcWV1pbGIdIXycrs-L0Dmg",
                      "https://lh3.googleusercontent.com/aida-public/AB6AXuD_vLkknzf3g87HCCQ0QNEXFh_iKneEpZLa11sIbju8D3SlF6dbV2XzykQZI_zWO5P5ehvx_9IrzSCasduXyL0qJ9lO_1fTx5kJlXvbUBHvWgkwHIO5Za7higaRA7chLbKf9dBX3OzFl734Y5eVm-SqkXX1x35PGIV6v93qxmrqUZ9zuUuZheItIWnQERo93GQox4FuecPz1jxCDDego_62GEADaRQ7XehaUABIyS1X5FOn1NRGdDBg",
                      "https://lh3.googleusercontent.com/aida-public/AB6AXuAIbxKGUmJ9yG9IKNIeXbUC2TEtRYRJTj1WjbPjy8GaktneKqntc3NnYk7CKdkJNP8bndK92YHEloCnBMNQVbwCYUhqTSHCG2xKFEjYXd0v1PjXbtRwLsJ32lOgu8x19imNv4I4ffkTy09fKncgcDNrjd6ollSZsE26jYQf1XN9-GulVLLYQhMipKn8n0NKLXCNGA2IFZbipg67LlTbKGKs7FqrInGTAi2oZqwvEgSgE-kt8WZcKE89Cw",
                    ].map((src, index) => (
                      <img
                        key={index}
                        src={src}
                        alt=""
                        className="w-10 h-10 rounded-full border-2 border-white object-cover shadow-sm"
                      />
                    ))}
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-[#FFDBC9] text-[#9B4500] flex items-center justify-center text-xs font-bold shadow-sm">
                      +12
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#031632]">
                      Session de révision active
                    </p>
                    <p className="text-xs text-[#44474D]">
                      4 contributeurs en ligne
                    </p>
                  </div>
                </div>

                <button className="text-xs font-semibold text-[#FC8A40] hover:underline flex items-center gap-1">
                  Rejoindre l'atelier
                  <span className="material-symbols-outlined text-sm">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>

            {/* GROUPES */}
            <div className="bg-white border border-[#C5C6CE]/40 rounded-2xl p-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <div className="space-y-3">
                <div className="w-11 h-11 bg-[#FFDBC9]/50 rounded-xl flex items-center justify-center text-[#9B4500] mb-4">
                  <span className="material-symbols-outlined text-2xl">
                    forum
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#031632]" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Groupes d'Étude
                </h3>

                <p className="text-sm text-[#44474D] leading-relaxed">
                  Rejoignez des cercles thématiques ciblés par matière ou
                  examen. Échangez des fiches récapitulatives et mesurez votre
                  progression ensemble.
                </p>
              </div>

              <button className="mt-6 pt-2 text-[#FC8A40] text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                Découvrir les groupes
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </button>
            </div>

            {/* DEFIS */}
            <div className="bg-white border border-[#C5C6CE]/40 rounded-2xl p-7 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
              <div className="space-y-3">
                <div className="w-11 h-11 bg-[#E0E3E6] rounded-xl flex items-center justify-center text-[#13181A] mb-4">
                  <span className="material-symbols-outlined text-2xl">
                    leaderboard
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#031632]" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Défis Hebdomadaires
                </h3>

                <p className="text-sm text-[#44474D] leading-relaxed">
                  Participez aux ligues de connaissances du week-end. Résolvez
                  des énigmes complexes, grimpez au classement et collectionnez
                  des récompenses exclusives.
                </p>
              </div>

              <div className="mt-6 pt-4 flex items-center justify-between text-xs text-[#44474D] border-t border-[#C5C6CE]/20">
                <span className="font-medium text-[#031632]">
                  Ligue actuelle : Saison 4
                </span>
                <span className="text-[#FC8A40] font-semibold">Top 5%</span>
              </div>
            </div>

            {/* LIVE */}
            <div className="bg-gradient-to-r from-[#031632] to-[#1A2B48] text-white border border-[#031632]/20 rounded-2xl p-7 md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md hover:shadow-lg transition-all relative overflow-hidden">
              <div className="space-y-2 relative z-10 max-w-md">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FC8A40] text-white text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  En direct ce samedi à 18h00
                </div>

                <h3 className="text-xl font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Grande Soirée Quiz Multijoueur
                </h3>

                <p className="text-xs md:text-sm text-white/80 leading-relaxed">
                  Vivez l'adrénaline des sessions géantes en temps réel. Plus de
                  1 000 participants simultanés avec des classements interactifs
                  instantanés.
                </p>
              </div>

              <button className="bg-[#FC8A40] hover:brightness-95 text-white font-semibold text-xs px-6 py-3 rounded-full shadow transition-all inline-flex items-center gap-2 relative z-10">
                <span className="material-symbols-outlined text-base">
                  event_available
                </span>
                Réserver ma place
              </button>
            </div>
          </div>
        </section>

        {/* TEMOIGNAGES */}
        <section className="space-y-10 pb-8 pt-4">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#FFDBC9]/50 text-[#9B4500] rounded-full text-xs font-semibold">
              <span className="material-symbols-outlined text-sm">
                format_quote
              </span>
              Retours d'expérience
            </div>

            <h2
              className="text-2xl md:text-3xl font-bold text-[#031632] tracking-tight"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              La parole à notre communauté
            </h2>

            <p className="text-sm text-[#44474D]">
              Découvrez comment les étudiants et formateurs progressent
              ensemble au quotidien.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-white border border-[#C5C6CE]/40 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex text-[#FC8A40] text-sm">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className="material-symbols-outlined text-lg"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                    ))}
                  </div>

                  <p className="text-sm text-[#44474D] leading-relaxed italic">
                    {testimonial.text}
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-6 border-t border-[#C5C6CE]/20 mt-6">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-11 h-11 rounded-full border border-[#C5C6CE]/30 object-cover"
                  />

                  <div>
                    <p className="text-sm font-bold text-[#031632]">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-[#44474D]">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

       {/* Footer */}
      <footer className="bg-primary text-on-primary w-full mt-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto border-t border-on-primary/10">
          <div className="flex flex-col gap-4">
             <Link to="/" className="flex items-center ">
            <h1 className="font-sans font-bold text-xl h-10 ">DMA<span className="text-[#fb691a]">EDUCATION</span></h1>
            </Link>
            <p className="font-body-md text-body-md text-on-primary/80">© 2026 DMAEDUCATION.</p>
          </div>
          <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:justify-end md:gap-8">
            <Link
              to="/about"
              className="font-label-sm text-label-sm text-on-primary/80 hover:text-on-primary hover:opacity-80 transition-all"
            >
              À propos
            </Link>
            <Link
              to="/community"
              className="font-label-sm text-label-sm text-on-primary/80 hover:text-on-primary hover:opacity-80 transition-all"
            >
              Communauté
            </Link>
            <a
              href="mailto:diarrassoubamohamedaliou@gmail.com"
              className="font-label-sm text-label-sm text-on-primary/80 hover:text-on-primary hover:opacity-80 transition-all"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Community;
