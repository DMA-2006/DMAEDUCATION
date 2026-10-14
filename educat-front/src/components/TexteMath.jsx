// src/components/TexteMath.jsx
import { InlineMath, BlockMath } from "react-katex";

// Découpe un texte contenant des formules LaTeX délimitées par $...$ (inline)
// ou $$...$$ (bloc, sur sa propre ligne), et rend chaque partie correctement :
// - le texte normal reste du texte normal
// - les formules sont rendues visuellement (fractions, exposants, racines...)
//   au lieu d'afficher le code LaTeX brut, illisible pour un humain.
//
// Si une formule est mal formée (LaTeX invalide), on affiche le code brut
// à la place plutôt que de faire planter toute la page.
export default function TexteMath({ texte }) {
  if (!texte) return null;

  // Sépare le texte en gardant les délimiteurs, pour traiter dans l'ordre :
  // d'abord les blocs $$...$$, puis à l'intérieur des morceaux restants,
  // les inline $...$.
  const morceaux = decouperEnMorceaux(texte);

  return (
    <>
      {morceaux.map((morceau, i) => {
        if (morceau.type === "texte") {
          return <span key={i}>{morceau.contenu}</span>;
        }
        if (morceau.type === "bloc") {
          return <FormuleSure key={i} formule={morceau.contenu} bloc />;
        }
        // "inline"
        return <FormuleSure key={i} formule={morceau.contenu} />;
      })}
    </>
  );
}

function FormuleSure({ formule, bloc }) {
  try {
    return bloc ? (
      <div className="my-2 overflow-x-auto">
        <BlockMath math={formule} />
      </div>
    ) : (
      <InlineMath math={formule} />
    );
  } catch {
    // LaTeX invalide : on retombe sur le texte brut plutôt que de casser la page.
    return <span className="font-mono text-sm">{bloc ? `$$${formule}$$` : `$${formule}$`}</span>;
  }
}

function decouperEnMorceaux(texte) {
  // Étape 1 : découpe sur les blocs $$...$$
  const morceauxBloc = texte.split(/(\$\$[^$]+\$\$)/g);

  const resultat = [];
  for (const partie of morceauxBloc) {
    if (!partie) continue;

    const estBloc = /^\$\$[^$]+\$\$$/.test(partie);
    if (estBloc) {
      resultat.push({ type: "bloc", contenu: partie.slice(2, -2).trim() });
      continue;
    }

    // Étape 2 : dans le texte restant, découpe sur les inline $...$
    const morceauxInline = partie.split(/(\$[^$]+\$)/g);
    for (const sousPartie of morceauxInline) {
      if (!sousPartie) continue;
      const estInline = /^\$[^$]+\$$/.test(sousPartie);
      if (estInline) {
        resultat.push({ type: "inline", contenu: sousPartie.slice(1, -1).trim() });
      } else {
        resultat.push({ type: "texte", contenu: sousPartie });
      }
    }
  }

  return resultat;
}