using UnityEngine;
using UnityEngine.UI;
using TMPro;

public class UIManager : MonoBehaviour
{
    [Header("HUD Elements")]
    public TextMeshProUGUI healthText;
    public TextMeshProUGUI scoreText;
    public TextMeshProUGUI ammoText;
    public Image crosshair;
    public Image healthBar;
    
    [Header("Game Over")]
    public GameObject gameOverPanel;
    public TextMeshProUGUI finalScoreText;
    public Button restartButton;
    
    [Header("Crosshair Settings")]
    public Color normalColor = Color.white;
    public Color hitColor = Color.red;
    
    private WeaponController playerWeapon;
    
    void Start()
    {
        // Find player weapon
        GameObject player = GameObject.FindGameObjectWithTag("Player");
        if (player)
        {
            playerWeapon = player.GetComponentInChildren<WeaponController>();
        }
        
        // Setup restart button
        if (restartButton)
        {
            restartButton.onClick.AddListener(() => GameManager.Instance.RestartGame());
        }
        
        // Hide game over panel
        if (gameOverPanel)
            gameOverPanel.SetActive(false);
    }
    
    void Update()
    {
        UpdateHUD();
    }
    
    void UpdateHUD()
    {
        // Health
        if (healthText)
            healthText.text = GameManager.Instance.playerHealth.ToString();
        
        if (healthBar)
            healthBar.fillAmount = GameManager.Instance.playerHealth / 100f;
        
        // Score
        if (scoreText)
            scoreText.text = "Score: " + GameManager.Instance.score;
        
        // Ammo
        if (ammoText && playerWeapon)
        {
            if (playerWeapon.IsReloading())
            {
                ammoText.text = "RELOADING...";
            }
            else
            {
                ammoText.text = playerWeapon.GetCurrentAmmo() + " / " + playerWeapon.GetMaxAmmo();
            }
        }
    }
    
    public void ShowHitMarker()
    {
        if (crosshair)
        {
            StartCoroutine(CrosshairHitEffect());
        }
    }
    
    System.Collections.IEnumerator CrosshairHitEffect()
    {
        crosshair.color = hitColor;
        yield return new WaitForSeconds(0.1f);
        crosshair.color = normalColor;
    }
    
    public void ShowGameOver()
    {
        if (gameOverPanel)
        {
            gameOverPanel.SetActive(true);
            
            if (finalScoreText)
                finalScoreText.text = "Final Score: " + GameManager.Instance.score;
        }
    }
}