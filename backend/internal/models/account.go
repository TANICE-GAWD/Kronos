package models

import(
	"fmt"
)

type User struct{
	ID uuid `json:"id"`
	Username string `json:username`
	HomePlanet string `json:"home_planet"`
}