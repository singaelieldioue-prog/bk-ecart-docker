// P0 : Sauvegarde JSON complète + Restauration
export function exportJSON(rapports) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: "bk_v1",
          exportedAt: new Date().toISOString(),
          rapports,
        },
        null,
        2
      ),
    ],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bk_rapports_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file, onSuccess, onError) {
  const fr = new FileReader();
  fr.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.rapports || !Array.isArray(data.rapports))
        throw new Error("Format JSON invalide — fichier non reconnu");
      onSuccess(data.rapports);
    } catch (err) {
      onError(err.message);
    }
  };
  fr.readAsText(file);
}
